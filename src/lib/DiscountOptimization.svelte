<script lang="ts">
  type InputRow = {
    region: string;
    department: string;
    discount: number;
    profit: number;
  };

  type Observation = {
    discount: number;
    profit: number;
    predicted: number;
  };

  type CurvePoint = {
    discount: number;
    profit: number;
  };

  type SegmentModel = {
    key: string;
    region: string;
    department: string;
    observations: Observation[];
    b0: number;
    b1: number;
    b2: number;
    rSquared: number;
    rmse: number;
    averageDiscount: number;
    recommendedDiscount: number;
    predictedCurrentProfit: number;
    predictedOptimalProfit: number;
    predictedImprovement: number;
    recommendationType: string;
    confidence: string;
  };

  type Bounds = {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };

  const chartWidth = 820;
  const chartHeight = 410;

  const padding = {
    left: 72,
    right: 28,
    top: 28,
    bottom: 62
  };

  const tickIndexes = [0, 1, 2, 3, 4, 5];

  let csvText = '';
  let minimumDiscount = 0;
  let maximumDiscount = 25;
  let minimumObservations = 6;

  let models: SegmentModel[] = [];
  let selectedKey = '';
  let errorMessage = '';
  let informationMessage = '';
  let hoveredObservation: Observation | null = null;

  let selectedModel: SegmentModel | null = null;
  let curvePoints: CurvePoint[] = [];
  let chartBounds: Bounds = {
    xMin: 0,
    xMax: 25,
    yMin: 0,
    yMax: 1
  };
  let curvePath = '';

  $: selectedModel =
    models.find((model) => model.key === selectedKey) ?? null;

  $: curvePoints = selectedModel
    ? sampleCurve(selectedModel)
    : [];

  $: chartBounds = selectedModel
    ? calculateBounds(selectedModel, curvePoints)
    : {
        xMin: minimumDiscount,
        xMax: maximumDiscount,
        yMin: 0,
        yMax: 1
      };

  $: curvePath = selectedModel
    ? buildCurvePath(curvePoints, chartBounds)
    : '';

  function normalizeHeader(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitDelimitedLine(
    line: string,
    delimiter: string
  ): string[] {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];

      if (character === '"') {
        if (
          insideQuotes &&
          line[index + 1] === '"'
        ) {
          current += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }

        continue;
      }

      if (character === delimiter && !insideQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += character;
    }

    values.push(current.trim());

    return values;
  }

  function detectDelimiter(headerLine: string): string {
    if (headerLine.includes('\t')) return '\t';

    if (
      headerLine.includes(';') &&
      !headerLine.includes(',')
    ) {
      return ';';
    }

    return ',';
  }

  function parseNumber(value: string): number {
    const trimmed = value.trim();
    const negative =
      trimmed.startsWith('(') &&
      trimmed.endsWith(')');

    const cleaned = trimmed
      .replace(/[()%$£€\s]/g, '')
      .replace(/,/g, '');

    const numericValue = Number(cleaned);

    return negative ? -numericValue : numericValue;
  }

  function locateColumn(
    headers: string[],
    acceptedNames: string[]
  ): number {
    const normalizedNames = acceptedNames.map(normalizeHeader);

    return headers.findIndex((header) =>
      normalizedNames.includes(header)
    );
  }

  function parseInputRows(): InputRow[] {
    const nonEmptyLines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (nonEmptyLines.length < 2) {
      throw new Error(
        'Paste a header row and at least one data row.'
      );
    }

    const delimiter = detectDelimiter(nonEmptyLines[0]);

    const headers = splitDelimitedLine(
      nonEmptyLines[0],
      delimiter
    ).map(normalizeHeader);

    const regionIndex = locateColumn(headers, [
      'region',
      'order region',
      'destination region',
      'customer region'
    ]);

    const departmentIndex = locateColumn(headers, [
      'department',
      'department name',
      'order department'
    ]);

    const discountIndex = locateColumn(headers, [
      'discount',
      'discount rate',
      'order item discount rate',
      'order item discount',
      'discount percentage'
    ]);

    const profitIndex = locateColumn(headers, [
      'profit',
      'order profit',
      'order profit per order',
      'profit per order',
      'margin',
      'contribution profit',
      'benefit per order'
    ]);

    const missingColumns: string[] = [];

    if (regionIndex === -1) missingColumns.push('region');
    if (departmentIndex === -1) missingColumns.push('department');
    if (discountIndex === -1) missingColumns.push('discount');
    if (profitIndex === -1) missingColumns.push('profit');

    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required column${missingColumns.length > 1 ? 's' : ''}: ${missingColumns.join(', ')}.`
      );
    }

    const rows: InputRow[] = [];

    for (const line of nonEmptyLines.slice(1)) {
      const values = splitDelimitedLine(line, delimiter);

      const region = values[regionIndex]?.trim();
      const department = values[departmentIndex]?.trim();

      let discount = parseNumber(
        values[discountIndex] ?? ''
      );

      const profit = parseNumber(
        values[profitIndex] ?? ''
      );

      if (
        !region ||
        !department ||
        !Number.isFinite(discount) ||
        !Number.isFinite(profit)
      ) {
        continue;
      }

      // Accept 0.10 as 10% and 10 as 10%.
      if (Math.abs(discount) <= 1) {
        discount *= 100;
      }

      rows.push({
        region,
        department,
        discount,
        profit
      });
    }

    return rows;
  }

  function solveThreeByThree(
    matrix: number[][],
    vector: number[]
  ): [number, number, number] | null {
    const augmented = matrix.map((row, index) => [
      ...row,
      vector[index]
    ]);

    for (let column = 0; column < 3; column += 1) {
      let pivotRow = column;

      for (
        let candidate = column + 1;
        candidate < 3;
        candidate += 1
      ) {
        if (
          Math.abs(augmented[candidate][column]) >
          Math.abs(augmented[pivotRow][column])
        ) {
          pivotRow = candidate;
        }
      }

      if (
        Math.abs(augmented[pivotRow][column]) <
        1e-10
      ) {
        return null;
      }

      [augmented[column], augmented[pivotRow]] = [
        augmented[pivotRow],
        augmented[column]
      ];

      const pivot = augmented[column][column];

      for (
        let cell = column;
        cell < 4;
        cell += 1
      ) {
        augmented[column][cell] /= pivot;
      }

      for (let row = 0; row < 3; row += 1) {
        if (row === column) continue;

        const multiplier = augmented[row][column];

        for (
          let cell = column;
          cell < 4;
          cell += 1
        ) {
          augmented[row][cell] -=
            multiplier * augmented[column][cell];
        }
      }
    }

    return [
      augmented[0][3],
      augmented[1][3],
      augmented[2][3]
    ];
  }

  function predict(
    b0: number,
    b1: number,
    b2: number,
    discount: number
  ): number {
    return b0 + b1 * discount + b2 * discount ** 2;
  }

  function fitSegment(
    region: string,
    department: string,
    rows: InputRow[]
  ): SegmentModel | null {
    const distinctDiscounts = new Set(
      rows.map((row) => row.discount.toFixed(6))
    );

    if (
      rows.length < minimumObservations ||
      distinctDiscounts.size < 3
    ) {
      return null;
    }

    const n = rows.length;

    const sumX = rows.reduce(
      (total, row) => total + row.discount,
      0
    );

    const sumX2 = rows.reduce(
      (total, row) => total + row.discount ** 2,
      0
    );

    const sumX3 = rows.reduce(
      (total, row) => total + row.discount ** 3,
      0
    );

    const sumX4 = rows.reduce(
      (total, row) => total + row.discount ** 4,
      0
    );

    const sumY = rows.reduce(
      (total, row) => total + row.profit,
      0
    );

    const sumXY = rows.reduce(
      (total, row) =>
        total + row.discount * row.profit,
      0
    );

    const sumX2Y = rows.reduce(
      (total, row) =>
        total + row.discount ** 2 * row.profit,
      0
    );

    const coefficients = solveThreeByThree(
      [
        [n, sumX, sumX2],
        [sumX, sumX2, sumX3],
        [sumX2, sumX3, sumX4]
      ],
      [sumY, sumXY, sumX2Y]
    );

    if (!coefficients) return null;

    const [b0, b1, b2] = coefficients;

    const observations = rows.map((row) => ({
      discount: row.discount,
      profit: row.profit,
      predicted: predict(
        b0,
        b1,
        b2,
        row.discount
      )
    }));

    const meanProfit =
      sumY / n;

    const sse = observations.reduce(
      (total, observation) =>
        total +
        (observation.profit -
          observation.predicted) ** 2,
      0
    );

    const totalSumSquares = rows.reduce(
      (total, row) =>
        total + (row.profit - meanProfit) ** 2,
      0
    );

    const rSquared =
      totalSumSquares === 0
        ? 1
        : 1 - sse / totalSumSquares;

    const rmse = Math.sqrt(
      sse / Math.max(n - 3, 1)
    );

    const averageDiscount =
      sumX / n;

    const candidateDiscounts = [
      minimumDiscount,
      maximumDiscount
    ];

    const vertex =
      Math.abs(b2) < 1e-10
        ? null
        : -b1 / (2 * b2);

    if (
      b2 < 0 &&
      vertex !== null &&
      vertex >= minimumDiscount &&
      vertex <= maximumDiscount
    ) {
      candidateDiscounts.push(vertex);
    }

    const recommendedDiscount =
      candidateDiscounts.reduce(
        (bestDiscount, candidateDiscount) =>
          predict(
            b0,
            b1,
            b2,
            candidateDiscount
          ) >
          predict(
            b0,
            b1,
            b2,
            bestDiscount
          )
            ? candidateDiscount
            : bestDiscount,
        candidateDiscounts[0]
      );

    const predictedCurrentProfit = predict(
      b0,
      b1,
      b2,
      averageDiscount
    );

    const predictedOptimalProfit = predict(
      b0,
      b1,
      b2,
      recommendedDiscount
    );

    const isInteriorRecommendation =
      b2 < 0 &&
      recommendedDiscount > minimumDiscount &&
      recommendedDiscount < maximumDiscount;

    const confidence =
      n >= 30 && rSquared >= 0.5
        ? 'Strong'
        : n >= 15 && rSquared >= 0.25
          ? 'Moderate'
          : 'Exploratory';

    return {
      key: `${region}|||${department}`,
      region,
      department,
      observations,
      b0,
      b1,
      b2,
      rSquared,
      rmse,
      averageDiscount,
      recommendedDiscount,
      predictedCurrentProfit,
      predictedOptimalProfit,
      predictedImprovement:
        predictedOptimalProfit -
        predictedCurrentProfit,
      recommendationType: isInteriorRecommendation
        ? 'Interior optimum'
        : 'Best corridor boundary',
      confidence
    };
  }

  function buildModels(): void {
    errorMessage = '';
    informationMessage = '';
    hoveredObservation = null;

    if (maximumDiscount <= minimumDiscount) {
      errorMessage =
        'Maximum discount must be greater than minimum discount.';
      return;
    }

    try {
      const rows = parseInputRows();

      if (rows.length === 0) {
        throw new Error(
          'No valid observations were found.'
        );
      }

      const groupedRows = new Map<string, InputRow[]>();

      for (const row of rows) {
        const key = `${row.region}|||${row.department}`;

        const group = groupedRows.get(key) ?? [];
        group.push(row);
        groupedRows.set(key, group);
      }

      const fittedModels: SegmentModel[] = [];
      let skippedSegments = 0;

      for (const [key, segmentRows] of groupedRows) {
        const [region, department] = key.split('|||');

        const model = fitSegment(
          region,
          department,
          segmentRows
        );

        if (model) {
          fittedModels.push(model);
        } else {
          skippedSegments += 1;
        }
      }

      fittedModels.sort((first, second) => {
        const regionComparison =
          first.region.localeCompare(second.region);

        return regionComparison !== 0
          ? regionComparison
          : first.department.localeCompare(
              second.department
            );
      });

      if (fittedModels.length === 0) {
        throw new Error(
          `No segment had at least ${minimumObservations} observations and three distinct discount levels.`
        );
      }

      models = fittedModels;
      selectedKey = fittedModels[0].key;

      informationMessage =
        `${fittedModels.length} region × department model${fittedModels.length === 1 ? '' : 's'} fitted.` +
        (skippedSegments > 0
          ? ` ${skippedSegments} segment${skippedSegments === 1 ? '' : 's'} skipped because of insufficient variation or observations.`
          : '');
    } catch (error) {
      models = [];
      selectedKey = '';

      errorMessage =
        error instanceof Error
          ? error.message
          : 'The data could not be processed.';
    }
  }

  async function uploadCsv(event: Event): Promise<void> {
    const input =
      event.currentTarget as HTMLInputElement;

    const file = input.files?.[0];

    if (!file) return;

    csvText = await file.text();
    errorMessage = '';
    informationMessage =
      `${file.name} loaded. Click Fit optimization models.`;
  }

  function clearData(): void {
    csvText = '';
    models = [];
    selectedKey = '';
    errorMessage = '';
    informationMessage = '';
    hoveredObservation = null;
  }

  function sampleCurve(
    model: SegmentModel
  ): CurvePoint[] {
    const points: CurvePoint[] = [];
    const steps = 80;

    for (let index = 0; index <= steps; index += 1) {
      const discount =
        minimumDiscount +
        ((maximumDiscount - minimumDiscount) *
          index) /
          steps;

      points.push({
        discount,
        profit: predict(
          model.b0,
          model.b1,
          model.b2,
          discount
        )
      });
    }

    return points;
  }

  function calculateBounds(
    model: SegmentModel,
    curve: CurvePoint[]
  ): Bounds {
    const xValues = [
      ...model.observations.map(
        (observation) => observation.discount
      ),
      minimumDiscount,
      maximumDiscount
    ];

    const yValues = [
      ...model.observations.map(
        (observation) => observation.profit
      ),
      ...curve.map((point) => point.profit)
    ];

    const rawYMin = Math.min(...yValues);
    const rawYMax = Math.max(...yValues);

    const yMargin = Math.max(
      (rawYMax - rawYMin) * 0.1,
      1
    );

    return {
      xMin: Math.min(...xValues),
      xMax: Math.max(...xValues),
      yMin: rawYMin - yMargin,
      yMax: rawYMax + yMargin
    };
  }

  function scaleX(
    value: number,
    bounds: Bounds
  ): number {
    const plotWidth =
      chartWidth - padding.left - padding.right;

    return (
      padding.left +
      ((value - bounds.xMin) /
        Math.max(
          bounds.xMax - bounds.xMin,
          Number.EPSILON
        )) *
        plotWidth
    );
  }

  function scaleY(
    value: number,
    bounds: Bounds
  ): number {
    const plotHeight =
      chartHeight - padding.top - padding.bottom;

    return (
      padding.top +
      plotHeight -
      ((value - bounds.yMin) /
        Math.max(
          bounds.yMax - bounds.yMin,
          Number.EPSILON
        )) *
        plotHeight
    );
  }

  function buildCurvePath(
    curve: CurvePoint[],
    bounds: Bounds
  ): string {
    return curve
      .map((point, index) => {
        const command = index === 0 ? 'M' : 'L';

        return `${command} ${scaleX(
          point.discount,
          bounds
        )} ${scaleY(point.profit, bounds)}`;
      })
      .join(' ');
  }

  function tickValue(
    minimum: number,
    maximum: number,
    tickIndex: number
  ): number {
    return (
      minimum +
      ((maximum - minimum) * tickIndex) / 5
    );
  }

  function money(value: number): string {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value);
  }
</script>

<section class="discount-page">
  <header class="page-header">
    <div>
      <span>REGION × DEPARTMENT PRICING</span>
      <h1>Discount Optimization</h1>

      <p>
        Fit separate profit curves and recommend the
        predicted margin-maximizing discount for every
        region and department.
      </p>
    </div>

    <div class="model-card">
      <small>Segment model</small>
      <strong>
        Profit = b₀ + b₁d + b₂d²
      </strong>
      <span>d = discount percentage</span>
    </div>
  </header>

  <section class="configuration">
    <div class="data-input">
      <div class="upload-row">
        <label class="file-button">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onchange={uploadCsv}
          />
        </label>

        <span>or paste the dataset below</span>
      </div>

      <textarea
        bind:value={csvText}
        rows="12"
        placeholder="Order Region,Department Name,Order Item Discount Rate,Order Profit Per Order"
      ></textarea>

      <small>
        Required columns: region, department, discount,
        and profit. Discount may be written as 0.10 or 10.
      </small>
    </div>

    <aside class="settings">
      <label>
        <span>Minimum allowed discount (%)</span>
        <input
          type="number"
          min="0"
          step="0.5"
          bind:value={minimumDiscount}
        />
      </label>

      <label>
        <span>Maximum allowed discount (%)</span>
        <input
          type="number"
          min="0"
          step="0.5"
          bind:value={maximumDiscount}
        />
      </label>

      <label>
        <span>Minimum observations per segment</span>
        <input
          type="number"
          min="4"
          step="1"
          bind:value={minimumObservations}
        />
      </label>

      <button class="fit-button" onclick={buildModels}>
        Fit optimization models
      </button>

      <button class="clear-button" onclick={clearData}>
        Clear
      </button>
    </aside>
  </section>

  {#if errorMessage}
    <div class="message error-message">
      {errorMessage}
    </div>
  {/if}

  {#if informationMessage}
    <div class="message information-message">
      {informationMessage}
    </div>
  {/if}

  {#if models.length > 0}
    <section class="results">
      <div class="results-heading">
        <div>
          <span>MODEL OUTPUT</span>
          <h2>Recommended discount by segment</h2>
        </div>

        <label>
          <span>Inspect segment</span>

          <select bind:value={selectedKey}>
            {#each models as model}
              <option value={model.key}>
                {model.region} — {model.department}
              </option>
            {/each}
          </select>
        </label>
      </div>

      <div class="recommendation-table">
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Department</th>
              <th>Observations</th>
              <th>Average discount</th>
              <th>Recommended discount</th>
              <th>Predicted improvement</th>
              <th>R²</th>
              <th>Confidence</th>
            </tr>
          </thead>

          <tbody>
            {#each models as model}
              <tr
                class:selected-row={selectedKey === model.key}
                onclick={() => (selectedKey = model.key)}
              >
                <td>{model.region}</td>
                <td>{model.department}</td>
                <td>{model.observations.length}</td>
                <td>{model.averageDiscount.toFixed(1)}%</td>
                <td>
                  <strong>
                    {model.recommendedDiscount.toFixed(1)}%
                  </strong>
                </td>
                <td>
                  {money(model.predictedImprovement)}
                </td>
                <td>{model.rSquared.toFixed(3)}</td>
                <td>{model.confidence}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if selectedModel}
        <section class="segment-detail">
          <div class="metrics">
            <article>
              <span>Recommended discount</span>
              <strong>
                {selectedModel.recommendedDiscount.toFixed(1)}%
              </strong>
              <small>
                {selectedModel.recommendationType}
              </small>
            </article>

            <article>
              <span>Current average</span>
              <strong>
                {selectedModel.averageDiscount.toFixed(1)}%
              </strong>
              <small>Observed segment average</small>
            </article>

            <article>
              <span>Predicted optimal profit</span>
              <strong>
                {money(
                  selectedModel.predictedOptimalProfit
                )}
              </strong>
              <small>Per order</small>
            </article>

            <article>
              <span>Predicted improvement</span>
              <strong>
                {money(
                  selectedModel.predictedImprovement
                )}
              </strong>
              <small>Per order versus current average</small>
            </article>

            <article>
              <span>Model quality</span>
              <strong>
                R² {selectedModel.rSquared.toFixed(3)}
              </strong>
              <small>
                RMSE {money(selectedModel.rmse)}
              </small>
            </article>
          </div>

          <div class="equation-card">
            <span>Fitted segment equation</span>

            <strong>
              Profit =
              {selectedModel.b0.toFixed(4)}
              {selectedModel.b1 >= 0 ? '+' : '−'}
              {Math.abs(selectedModel.b1).toFixed(4)}d
              {selectedModel.b2 >= 0 ? '+' : '−'}
              {Math.abs(selectedModel.b2).toFixed(4)}d²
            </strong>
          </div>

          <div class="chart-container">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label="Observed profit and fitted discount optimization curve"
            >
              {#each tickIndexes as tick}
                {@const yValue = tickValue(
                  chartBounds.yMin,
                  chartBounds.yMax,
                  tick
                )}

                <line
                  x1={padding.left}
                  y1={scaleY(yValue, chartBounds)}
                  x2={chartWidth - padding.right}
                  y2={scaleY(yValue, chartBounds)}
                  class="grid-line"
                />

                <text
                  x={padding.left - 10}
                  y={scaleY(yValue, chartBounds) + 4}
                  text-anchor="end"
                  class="tick-label"
                >
                  {money(yValue)}
                </text>
              {/each}

              {#each tickIndexes as tick}
                {@const xValue = tickValue(
                  chartBounds.xMin,
                  chartBounds.xMax,
                  tick
                )}

                <line
                  x1={scaleX(xValue, chartBounds)}
                  y1={padding.top}
                  x2={scaleX(xValue, chartBounds)}
                  y2={chartHeight - padding.bottom}
                  class="grid-line"
                />

                <text
                  x={scaleX(xValue, chartBounds)}
                  y={chartHeight - padding.bottom + 22}
                  text-anchor="middle"
                  class="tick-label"
                >
                  {xValue.toFixed(1)}%
                </text>
              {/each}

              <line
                x1={padding.left}
                y1={chartHeight - padding.bottom}
                x2={chartWidth - padding.right}
                y2={chartHeight - padding.bottom}
                class="axis-line"
              />

              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={chartHeight - padding.bottom}
                class="axis-line"
              />

              <path
                d={curvePath}
                class="profit-curve"
              />

              <line
                x1={scaleX(
                  selectedModel.recommendedDiscount,
                  chartBounds
                )}
                y1={padding.top}
                x2={scaleX(
                  selectedModel.recommendedDiscount,
                  chartBounds
                )}
                y2={chartHeight - padding.bottom}
                class="optimal-guide"
              />

              <circle
                cx={scaleX(
                  selectedModel.recommendedDiscount,
                  chartBounds
                )}
                cy={scaleY(
                  selectedModel.predictedOptimalProfit,
                  chartBounds
                )}
                r="8"
                class="optimal-point"
              />

              {#each selectedModel.observations as observation}
                <circle
                  cx={scaleX(
                    observation.discount,
                    chartBounds
                  )}
                  cy={scaleY(
                    observation.profit,
                    chartBounds
                  )}
                  r={hoveredObservation === observation ? 8 : 5}
                  class="observed-point"
                  onpointerenter={() =>
                    (hoveredObservation = observation)}
                  onpointerleave={() =>
                    (hoveredObservation = null)}
                />
              {/each}

              <text
                x={padding.left +
                  (chartWidth -
                    padding.left -
                    padding.right) /
                    2}
                y={chartHeight - 11}
                text-anchor="middle"
                class="axis-label"
              >
                Discount percentage
              </text>

              <text
                x="19"
                y={chartHeight / 2}
                text-anchor="middle"
                transform={`rotate(-90 19 ${chartHeight / 2})`}
                class="axis-label"
              >
                Profit per order
              </text>
            </svg>

            {#if hoveredObservation}
              <div class="tooltip">
                <strong>Observed order</strong>

                <div>
                  <span>Discount</span>
                  <b>
                    {hoveredObservation.discount.toFixed(2)}%
                  </b>
                </div>

                <div>
                  <span>Actual profit</span>
                  <b>
                    {money(hoveredObservation.profit)}
                  </b>
                </div>

                <div>
                  <span>Predicted profit</span>
                  <b>
                    {money(hoveredObservation.predicted)}
                  </b>
                </div>

                <div>
                  <span>Residual</span>
                  <b>
                    {money(
                      hoveredObservation.profit -
                        hoveredObservation.predicted
                    )}
                  </b>
                </div>
              </div>
            {/if}
          </div>

          <div class="legend">
            <span>
              <i class="observed-key"></i>
              Observed order profit
            </span>

            <span>
              <i class="curve-key"></i>
              Fitted quadratic regression
            </span>

            <span>
              <i class="optimal-key"></i>
              Recommended discount
            </span>
          </div>

          <div class="limitation">
            <strong>Decision boundary</strong>

            <p>
              This recommendation maximizes predicted profit per
              order inside the selected discount corridor. It is
              directional rather than causal and should be validated
              with controlled pricing tests. To optimize total
              contribution instead, include quantity or demand-volume
              data in the next model.
            </p>
          </div>
        </section>
      {/if}
    </section>
  {:else}
    <section class="empty-state">
      <span>↗</span>
      <h2>No discount models fitted</h2>

      <p>
        Upload or paste your DataCo order data to generate
        region × department discount recommendations.
      </p>
    </section>
  {/if}
</section>

<style>
  .discount-page {
    overflow: hidden;
    border: 1px solid #e4e5ef;
    border-radius: 22px;
    background: #f7f8fc;
    box-shadow: 0 12px 38px rgba(28, 27, 55, 0.07);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    gap: 30px;
    padding: 30px;
    border-right: 14px solid #ff8d21;
    background: #000080;
    color: #ffffff;
  }

  .page-header > div:first-child > span {
    color: #ffc78e;
    font-size: 0.67rem;
    font-weight: 850;
    letter-spacing: 0.14em;
  }

  h1 {
    margin: 7px 0;
    font-size: clamp(2rem, 4vw, 3.5rem);
    letter-spacing: -0.045em;
  }

  .page-header p {
    max-width: 720px;
    margin: 0;
    color: #dedfff;
    line-height: 1.55;
  }

  .model-card {
    min-width: 300px;
    padding: 16px 18px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.1);
  }

  .model-card small,
  .model-card strong,
  .model-card span {
    display: block;
  }

  .model-card small {
    color: #dedfff;
    font-size: 0.65rem;
  }

  .model-card strong {
    margin: 7px 0;
  }

  .model-card span {
    color: #ffc78e;
    font-size: 0.72rem;
  }

  .configuration {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.6fr);
    gap: 20px;
    padding: 24px;
    background: #ffffff;
  }

  .data-input,
  .settings {
    padding: 18px;
    border: 1px solid #e7e6ef;
    border-radius: 15px;
    background: #fafafe;
  }

  .upload-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .upload-row > span {
    color: #85818f;
    font-size: 0.69rem;
  }

  .file-button {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 9px;
    background: #000080;
    color: #ffffff;
    font-size: 0.73rem;
    font-weight: 800;
    cursor: pointer;
  }

  .file-button input {
    display: none;
  }

  textarea {
    width: 100%;
    min-height: 230px;
    resize: vertical;
    border: 1px solid #d9d8e3;
    border-radius: 10px;
    background: #ffffff;
    padding: 12px;
    color: #242130;
    outline: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.74rem;
    line-height: 1.5;
  }

  textarea:focus,
  input:focus,
  select:focus {
    border-color: #ff8d21;
    box-shadow: 0 0 0 3px rgba(255, 141, 33, 0.13);
    outline: none;
  }

  .data-input > small {
    display: block;
    margin-top: 8px;
    color: #817d8c;
    font-size: 0.67rem;
  }

  .settings label {
    display: block;
    margin-bottom: 14px;
  }

  .settings label span {
    display: block;
    margin-bottom: 7px;
    color: #555162;
    font-size: 0.7rem;
    font-weight: 750;
  }

  .settings input,
  .results-heading select {
    width: 100%;
    min-height: 42px;
    border: 1px solid #d9d8e3;
    border-radius: 9px;
    background: #ffffff;
    padding: 0 11px;
    color: #242130;
    font: inherit;
  }

  .fit-button,
  .clear-button {
    width: 100%;
    min-height: 44px;
    border-radius: 9px;
    font: inherit;
    font-size: 0.74rem;
    font-weight: 800;
    cursor: pointer;
  }

  .fit-button {
    border: 0;
    background: #000080;
    color: #ffffff;
  }

  .fit-button:hover {
    background: #1717a7;
  }

  .clear-button {
    margin-top: 9px;
    border: 1px solid #d8d7e1;
    background: #ffffff;
    color: #565261;
  }

  .message {
    margin: 18px 24px 0;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.73rem;
  }

  .error-message {
    border: 1px solid #efc2bc;
    background: #fff0ee;
    color: #9f3026;
  }

  .information-message {
    border: 1px solid #bde7ce;
    background: #eaf9f0;
    color: #16683e;
  }

  .results {
    padding: 24px;
  }

  .results-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 25px;
    margin-bottom: 16px;
  }

  .results-heading > div > span {
    color: #e97800;
    font-size: 0.65rem;
    font-weight: 850;
    letter-spacing: 0.11em;
  }

  .results-heading h2 {
    margin: 5px 0 0;
    color: #000080;
  }

  .results-heading label {
    min-width: 310px;
  }

  .results-heading label span {
    display: block;
    margin-bottom: 7px;
    color: #5c5868;
    font-size: 0.68rem;
    font-weight: 750;
  }

  .recommendation-table {
    overflow: auto;
    border: 1px solid #e5e5ee;
    border-radius: 13px;
    background: #ffffff;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.7rem;
  }

  th,
  td {
    padding: 11px;
    border-bottom: 1px solid #ecebf2;
    text-align: right;
    white-space: nowrap;
  }

  th:first-child,
  td:first-child,
  th:nth-child(2),
  td:nth-child(2) {
    text-align: left;
  }

  th {
    background: #f2f2f7;
    color: #625e6e;
  }

  tbody tr {
    cursor: pointer;
  }

  tbody tr:hover,
  .selected-row {
    background: #fff6ec;
  }

  td strong {
    color: #000080;
  }

  .segment-detail {
    margin-top: 20px;
    padding: 20px;
    border: 1px solid #e5e5ee;
    border-radius: 16px;
    background: #ffffff;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
  }

  .metrics article {
    padding: 13px;
    border: 1px solid #e9e8ef;
    border-radius: 11px;
    background: #fafafe;
  }

  .metrics span,
  .metrics strong,
  .metrics small {
    display: block;
  }

  .metrics span {
    color: #777382;
    font-size: 0.62rem;
  }

  .metrics strong {
    margin-top: 7px;
    color: #000080;
    font-size: 1rem;
  }

  .metrics small {
    margin-top: 5px;
    color: #8a8694;
    font-size: 0.61rem;
  }

  .equation-card {
    margin: 13px 0;
    padding: 12px 14px;
    border-left: 4px solid #ff8d21;
    border-radius: 4px 9px 9px 4px;
    background: #fff7ef;
  }

  .equation-card span,
  .equation-card strong {
    display: block;
  }

  .equation-card span {
    color: #776e65;
    font-size: 0.64rem;
  }

  .equation-card strong {
    margin-top: 6px;
    color: #000080;
  }

  .chart-container {
    position: relative;
    overflow-x: auto;
    border-radius: 12px;
    background: #ffffff;
  }

  svg {
    display: block;
    width: 100%;
    min-width: 680px;
  }

  .grid-line {
    stroke: #ecebf2;
    stroke-width: 1;
  }

  .axis-line {
    stroke: #9996a3;
    stroke-width: 1.3;
  }

  .profit-curve {
    fill: none;
    stroke: #000080;
    stroke-width: 4;
  }

  .optimal-guide {
    stroke: #ff8d21;
    stroke-width: 2.5;
    stroke-dasharray: 6 5;
  }

  .optimal-point {
    fill: #ff8d21;
    stroke: #8f4300;
    stroke-width: 2.5;
  }

  .observed-point {
    fill: #000080;
    stroke: #ffffff;
    stroke-width: 2;
    cursor: crosshair;
  }

  .tick-label {
    fill: #777382;
    font-size: 10px;
  }

  .axis-label {
    fill: #3d3948;
    font-size: 11px;
    font-weight: 750;
  }

  .tooltip {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 225px;
    padding: 13px;
    border: 1px solid #d8d7e3;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 12px 30px rgba(25, 24, 50, 0.18);
    pointer-events: none;
  }

  .tooltip > strong {
    display: block;
    margin-bottom: 9px;
    color: #000080;
    font-size: 0.76rem;
  }

  .tooltip div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 6px;
    font-size: 0.68rem;
  }

  .tooltip span {
    color: #777382;
  }

  .tooltip b {
    color: #24212e;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 17px;
    margin-top: 12px;
    color: #696574;
    font-size: 0.68rem;
  }

  .legend span {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .legend i {
    display: inline-block;
  }

  .observed-key {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #000080;
  }

  .curve-key {
    width: 19px;
    height: 3px;
    background: #000080;
  }

  .optimal-key {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff8d21;
  }

  .limitation {
    margin-top: 15px;
    padding: 14px;
    border: 1px solid #ffd7ad;
    border-radius: 11px;
    background: #fff8f0;
  }

  .limitation strong {
    color: #c65f00;
  }

  .limitation p {
    margin: 6px 0 0;
    color: #696574;
    font-size: 0.72rem;
    line-height: 1.55;
  }

  .empty-state {
    min-height: 330px;
    display: grid;
    place-items: center;
    align-content: center;
    padding: 30px;
    text-align: center;
  }

  .empty-state > span {
    color: #ff8d21;
    font-size: 3rem;
  }

  .empty-state h2 {
    margin: 10px 0 5px;
    color: #000080;
  }

  .empty-state p {
    max-width: 520px;
    margin: 0;
    color: #716d7b;
    font-size: 0.76rem;
  }

  @media (max-width: 1050px) {
    .page-header {
      flex-direction: column;
    }

    .model-card {
      min-width: 0;
    }

    .configuration {
      grid-template-columns: 1fr;
    }

    .metrics {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 720px) {
    .page-header {
      padding: 22px;
    }

    .results-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .results-heading label {
      min-width: 0;
    }

    .metrics {
      grid-template-columns: 1fr 1fr;
    }

    .configuration,
    .results {
      padding: 16px;
    }
  }
</style>
