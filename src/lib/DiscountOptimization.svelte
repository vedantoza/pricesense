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

  type GeographyLevel = 'country' | 'continent';
  type SortDirection = 'ascending' | 'descending';
  type OptimizationScope = 'specific' | 'all';
  type InputMode = 'upload' | 'manual';

  type ApiOptimizationResult = {
    region: string;
    department: string;
    observations: number;
    recommended_discount_pct: number;
    predicted_profit: number;
    historical_discount_pct: number;
    predicted_profit_uplift: number;
    r_squared: number;
    rmse: number;
    quadratic_coefficient: number;
    linear_coefficient: number;
    intercept: number;
  };

  type ApiOptimizeResponse = {
    success: boolean;
    model: string;
    result: ApiOptimizationResult;
    detail?: unknown;
  };

  const API_BASE_URL = 'http://127.0.0.1:8001';

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
  let geographyLevel: GeographyLevel = 'continent';
  let sortDirection: SortDirection = 'ascending';
  let optimizationScope: OptimizationScope = 'specific';
  let inputMode: InputMode = 'upload';

  let preparedRows: InputRow[] = [];
  let availableGeographies: string[] = [];
  let availableDepartments: string[] = [];
  let selectedGeography = '';
  let selectedDepartment = '';

  let manualGeography = '';
  let manualDepartment = '';
  let manualObservations = '';

  let models: SegmentModel[] = [];
  let sortedModels: SegmentModel[] = [];
  let selectedKey = '';
  let errorMessage = '';
  let informationMessage = '';
  let hoveredObservation: Observation | null = null;
  let isLoading = false;

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

  $: sortedModels = [...models].sort((first, second) => {
    const recommendationDifference =
      first.recommendedDiscount - second.recommendedDiscount;

    if (Math.abs(recommendationDifference) > Number.EPSILON) {
      return sortDirection === 'ascending'
        ? recommendationDifference
        : -recommendationDifference;
    }

    const geographyComparison =
      first.region.localeCompare(second.region);

    return geographyComparison !== 0
      ? geographyComparison
      : first.department.localeCompare(second.department);
  });

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

  function geographyLabel(): string {
    return geographyLevel === 'country'
      ? 'Country'
      : 'Continent';
  }

  function geographyLabelLower(): string {
    return geographyLevel === 'country'
      ? 'country'
      : 'continent';
  }

  function handleGeographyChange(event: Event): void {
    geographyLevel = (
      event.currentTarget as HTMLSelectElement
    ).value as GeographyLevel;

    preparedRows = [];
    availableGeographies = [];
    availableDepartments = [];
    selectedGeography = '';
    selectedDepartment = '';
    models = [];
    selectedKey = '';
    errorMessage = '';
    hoveredObservation = null;
    informationMessage = csvText.trim()
      ? `Geography changed to ${geographyLabel()}. Reload the fields, then run the optimization.`
      : '';
  }

  function handleInputModeChange(event: Event): void {
    inputMode = (
      event.currentTarget as HTMLSelectElement
    ).value as InputMode;

    if (inputMode === 'manual') {
      optimizationScope = 'specific';
    }

    models = [];
    selectedKey = '';
    errorMessage = '';
    informationMessage = '';
  }

  function handleScopeChange(event: Event): void {
    optimizationScope = (
      event.currentTarget as HTMLSelectElement
    ).value as OptimizationScope;

    if (
      optimizationScope === 'all' &&
      inputMode === 'manual'
    ) {
      inputMode = 'upload';
    }

    models = [];
    selectedKey = '';
    errorMessage = '';
    informationMessage = '';
  }

  function updateDepartmentOptions(): void {
    availableDepartments = Array.from(
      new Set(
        preparedRows
          .filter((row) =>
            selectedGeography
              ? row.region === selectedGeography
              : true
          )
          .map((row) => row.department)
      )
    ).sort((first, second) => first.localeCompare(second));

    if (
      !availableDepartments.includes(selectedDepartment)
    ) {
      selectedDepartment = availableDepartments[0] ?? '';
    }
  }

  function updateSelectionOptions(rows: InputRow[]): void {
    preparedRows = rows;

    availableGeographies = Array.from(
      new Set(rows.map((row) => row.region))
    ).sort((first, second) => first.localeCompare(second));

    if (!availableGeographies.includes(selectedGeography)) {
      selectedGeography = availableGeographies[0] ?? '';
    }

    updateDepartmentOptions();
  }

  function handleSelectedGeographyChange(event: Event): void {
    selectedGeography = (
      event.currentTarget as HTMLSelectElement
    ).value;

    updateDepartmentOptions();
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

    const countryIndex = locateColumn(headers, [
      'country',
      'order country',
      'destination country',
      'customer country',
      'shipping country'
    ]);

    const continentIndex = locateColumn(headers, [
      'continent',
      'order continent',
      'destination continent',
      'customer continent',
      'region',
      'order region',
      'destination region',
      'customer region',
      'market'
    ]);

    const geographyIndex =
      geographyLevel === 'country'
        ? countryIndex
        : continentIndex;

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

    if (geographyIndex === -1) {
      missingColumns.push(
        geographyLevel === 'country'
          ? 'country'
          : 'continent or region'
      );
    }

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

      const region = values[geographyIndex]?.trim();
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


  function parseManualRows(): InputRow[] {
    const geography = manualGeography.trim();
    const department = manualDepartment.trim();

    if (!geography) {
      throw new Error(
        `Enter the ${geographyLabelLower()} for the specific selection.`
      );
    }

    if (!department) {
      throw new Error(
        'Enter the department for the specific selection.'
      );
    }

    const lines = manualObservations
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < minimumObservations) {
      throw new Error(
        `Enter at least ${minimumObservations} discount and profit observations.`
      );
    }

    const rows: InputRow[] = [];

    for (const [index, line] of lines.entries()) {
      const values = line
        .split(/[,;\t ]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      let discount = parseNumber(values[0] ?? '');
      const profit = parseNumber(values[1] ?? '');

      if (
        !Number.isFinite(discount) ||
        !Number.isFinite(profit)
      ) {
        throw new Error(
          `Invalid manual observation on line ${index + 1}. Use discount,profit.`
        );
      }

      if (Math.abs(discount) <= 1) {
        discount *= 100;
      }

      rows.push({
        region: geography,
        department,
        discount,
        profit
      });
    }

    return rows;
  }

  function rowsForCurrentInput(): InputRow[] {
    if (inputMode === 'manual') {
      return parseManualRows();
    }

    const rows = parseInputRows();

    if (optimizationScope === 'specific') {
      if (!selectedGeography || !selectedDepartment) {
        updateSelectionOptions(rows);
      }

      if (!selectedGeography || !selectedDepartment) {
        throw new Error(
          `Choose a ${geographyLabelLower()} and department before optimizing.`
        );
      }

      const selectedRows = rows.filter(
        (row) =>
          row.region === selectedGeography &&
          row.department === selectedDepartment
      );

      if (selectedRows.length === 0) {
        throw new Error(
          `No observations were found for ${selectedGeography} / ${selectedDepartment}.`
        );
      }

      return selectedRows;
    }

    return rows;
  }

  function prepareSelectionFields(): void {
    errorMessage = '';

    try {
      const rows = parseInputRows();
      updateSelectionOptions(rows);
      informationMessage =
        `${availableGeographies.length} ${geographyLabelLower()} option${availableGeographies.length === 1 ? '' : 's'} loaded. Choose a specific selection.`;
    } catch (error) {
      informationMessage = '';
      errorMessage =
        error instanceof Error
          ? error.message
          : 'The uploaded data could not be read.';
    }
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

    const rmse = Math.sqrt(sse / n);

    const sortedDiscounts = rows
      .map((row) => row.discount)
      .sort((first, second) => first - second);

    const middleIndex = Math.floor(n / 2);

    const historicalDiscount =
      n % 2 === 0
        ? (sortedDiscounts[middleIndex - 1] +
            sortedDiscounts[middleIndex]) /
          2
        : sortedDiscounts[middleIndex];

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
      historicalDiscount
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
      averageDiscount: historicalDiscount,
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

  function apiErrorMessage(detail: unknown): string {
    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (
            typeof item === 'object' &&
            item !== null &&
            'msg' in item
          ) {
            return String(item.msg);
          }

          return String(item);
        })
        .join(', ');
    }

    return 'The Python optimization API rejected the request.';
  }

  async function requestSegmentModel(
    region: string,
    department: string,
    rows: InputRow[]
  ): Promise<SegmentModel> {
    const response = await fetch(
      `${API_BASE_URL}/optimize`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          region,
          department,
          observations: rows.map((row) => ({
            discount: row.discount,
            profit: row.profit
          }))
        })
      }
    );

    const responseBody =
      (await response.json()) as ApiOptimizeResponse;

    if (!response.ok) {
      throw new Error(
        apiErrorMessage(responseBody.detail)
      );
    }

    const result = responseBody.result;

    /*
     * Python fits discount as a decimal:
     *   profit = intercept + linear*d + quadratic*d²
     *
     * This Svelte chart uses percentage points, so:
     *   14.16% is represented as 14.16, not 0.1416.
     */
    const b0 = result.intercept;
    const b1 = result.linear_coefficient / 100;
    const b2 = result.quadratic_coefficient / 10_000;

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

    const historicalDiscount =
      result.historical_discount_pct;

    const predictedCurrentProfit =
      result.predicted_profit -
      result.predicted_profit_uplift;

    const isInteriorRecommendation =
      result.recommended_discount_pct >
        minimumDiscount &&
      result.recommended_discount_pct <
        maximumDiscount;

    const confidence =
      result.observations >= 30 &&
      result.r_squared >= 0.5
        ? 'Strong'
        : result.observations >= 15 &&
            result.r_squared >= 0.25
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
      rSquared: result.r_squared,
      rmse: result.rmse,
      averageDiscount: historicalDiscount,
      recommendedDiscount:
        result.recommended_discount_pct,
      predictedCurrentProfit,
      predictedOptimalProfit:
        result.predicted_profit,
      predictedImprovement:
        result.predicted_profit_uplift,
      recommendationType: isInteriorRecommendation
        ? 'Interior optimum'
        : 'Best observed boundary',
      confidence
    };
  }

  function isNetworkFailure(error: unknown): boolean {
    if (error instanceof TypeError) return true;

    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed')
    );
  }

  async function buildModels(): Promise<void> {
    errorMessage = '';
    informationMessage = '';
    hoveredObservation = null;
    isLoading = true;

    if (maximumDiscount <= minimumDiscount) {
      errorMessage =
        'Maximum discount must be greater than minimum discount.';
      isLoading = false;
      return;
    }

    try {
      const rows = rowsForCurrentInput();

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
      let browserFallbackSegments = 0;
      let apiUnavailable = false;

      for (const [key, segmentRows] of groupedRows) {
        const [region, department] = key.split('|||');

        const distinctDiscounts = new Set(
          segmentRows.map((row) =>
            row.discount.toFixed(6)
          )
        );

        if (
          segmentRows.length < minimumObservations ||
          distinctDiscounts.size < 3
        ) {
          skippedSegments += 1;
          continue;
        }

        let model: SegmentModel | null = null;

        if (!apiUnavailable) {
          try {
            model = await requestSegmentModel(
              region,
              department,
              segmentRows
            );
          } catch (error) {
            if (isNetworkFailure(error)) {
              apiUnavailable = true;
            } else {
              const message =
                error instanceof Error
                  ? error.message
                  : 'Unknown API error.';

              throw new Error(
                `${region} / ${department}: ${message}`
              );
            }
          }
        }

        if (!model) {
          model = fitSegment(
            region,
            department,
            segmentRows
          );

          if (model) {
            browserFallbackSegments += 1;
          }
        }

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

      const scopeText =
        optimizationScope === 'specific'
          ? 'specific selection'
          : `${geographyLabelLower()} × department segments`;

      informationMessage =
        `${fittedModels.length} model${fittedModels.length === 1 ? '' : 's'} fitted for the ${scopeText}.` +
        (browserFallbackSegments > 0
          ? ` The Python API could not be reached, so ${browserFallbackSegments} model${browserFallbackSegments === 1 ? '' : 's'} used the built-in browser calculation.`
          : ' Python API connected successfully.') +
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
    } finally {
      isLoading = false;
    }
  }

  async function uploadCsv(event: Event): Promise<void> {
    const input =
      event.currentTarget as HTMLInputElement;

    const file = input.files?.[0];

    if (!file) return;

    csvText = await file.text();
    errorMessage = '';

    try {
      const rows = parseInputRows();
      updateSelectionOptions(rows);
      informationMessage =
        `${file.name} loaded. Choose a ${geographyLabelLower()} and department, or optimize all segments.`;
    } catch (error) {
      preparedRows = [];
      availableGeographies = [];
      availableDepartments = [];
      selectedGeography = '';
      selectedDepartment = '';
      informationMessage = `${file.name} loaded.`;
      errorMessage =
        error instanceof Error
          ? error.message
          : 'The uploaded file could not be read.';
    }
  }

  function clearData(): void {
    csvText = '';
    manualGeography = '';
    manualDepartment = '';
    manualObservations = '';
    preparedRows = [];
    availableGeographies = [];
    availableDepartments = [];
    selectedGeography = '';
    selectedDepartment = '';
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
      <span>{geographyLabel().toUpperCase()} × DEPARTMENT PRICING</span>
      <h1>Discount Optimization</h1>

      <p>
        Choose a specific {geographyLabelLower()} and department, or
        fit every uploaded segment, to find the predicted
        margin-maximizing discount.
      </p>
    </div>

    <div class="model-card">
      <label>
        <small>Optimization target</small>
        <select
          value={optimizationScope}
          onchange={handleScopeChange}
        >
          <option value="specific">
            Specific selection
          </option>
          <option value="all">
            All uploaded segments
          </option>
        </select>
      </label>

      <strong>Profit = b₀ + b₁d + b₂d²</strong>
      <span>d = discount percentage</span>
    </div>
  </header>

  <section class="configuration">
    <div class="data-input">
      <div class="input-heading-row">
        <div>
          <span>DATA SOURCE</span>
          <h2>
            {inputMode === 'upload'
              ? 'Upload or paste a dataset'
              : 'Enter a specific segment'}
          </h2>
        </div>

        <label class="input-mode-select">
          <span>Choose input method</span>
          <select
            value={inputMode}
            onchange={handleInputModeChange}
          >
            <option value="upload">Upload file / paste data</option>
            <option value="manual">Enter fields manually</option>
          </select>
        </label>
      </div>

      {#if inputMode === 'upload'}
        <div class="upload-row">
          <label class="file-button">
            Choose upload file
            <input
              type="file"
              accept=".csv,text/csv"
              onchange={uploadCsv}
            />
          </label>

          <button
            class="secondary-action"
            type="button"
            onclick={prepareSelectionFields}
          >
            Load selection fields
          </button>

          <span>CSV upload and pasted data are both supported.</span>
        </div>

        <textarea
          bind:value={csvText}
          rows="12"
          placeholder={geographyLevel === 'country'
            ? 'Order Country,Department Name,Order Item Discount Rate,Order Profit Per Order'
            : 'Continent,Department Name,Order Item Discount Rate,Order Profit Per Order'}
        ></textarea>

        <small>
          Required columns: {geographyLabelLower()}, department,
          discount, and profit. For continent mode, a region column is
          also accepted. Discount may be written as 0.10 or 10.
        </small>

        {#if optimizationScope === 'specific'}
          <div class="specific-fields">
            <label>
              <span>Select {geographyLabelLower()}</span>
              <select
                value={selectedGeography}
                onchange={handleSelectedGeographyChange}
                disabled={availableGeographies.length === 0}
              >
                {#if availableGeographies.length === 0}
                  <option value="">
                    Upload data, then load fields
                  </option>
                {:else}
                  {#each availableGeographies as geography}
                    <option value={geography}>{geography}</option>
                  {/each}
                {/if}
              </select>
            </label>

            <label>
              <span>Select department</span>
              <select
                bind:value={selectedDepartment}
                disabled={availableDepartments.length === 0}
              >
                {#if availableDepartments.length === 0}
                  <option value="">No department loaded</option>
                {:else}
                  {#each availableDepartments as department}
                    <option value={department}>{department}</option>
                  {/each}
                {/if}
              </select>
            </label>
          </div>
        {/if}
      {:else}
        <div class="manual-fields">
          <label>
            <span>{geographyLabel()}</span>
            <input
              type="text"
              bind:value={manualGeography}
              placeholder={geographyLevel === 'country'
                ? 'Canada'
                : 'Pacific Asia'}
            />
          </label>

          <label>
            <span>Department</span>
            <input
              type="text"
              bind:value={manualDepartment}
              placeholder="Fitness"
            />
          </label>
        </div>

        <label class="manual-observations">
          <span>Discount and profit observations</span>
          <textarea
            bind:value={manualObservations}
            rows="12"
            placeholder={`0,90
5,103
10,112
15,118
20,114
25,102`}
          ></textarea>
        </label>

        <small>
          Enter one observation per line as discount,profit. Manual
          entry optimizes only the selected {geographyLabelLower()} and
          department.
        </small>
      {/if}
    </div>

    <aside class="settings">
      <label>
        <span>Choose geography</span>
        <select
          value={geographyLevel}
          onchange={handleGeographyChange}
        >
          <option value="country">Country</option>
          <option value="continent">Continent</option>
        </select>
      </label>

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

      <button
        class="fit-button"
        onclick={buildModels}
        disabled={isLoading}
      >
        {isLoading
          ? 'Optimizing…'
          : optimizationScope === 'specific'
            ? 'Optimize specific selection'
            : 'Fit all optimization models'}
      </button>

      <button class="clear-button" onclick={clearData}>
        Clear
      </button>

      <p class="api-note">
        The page first uses your Python API. When the API cannot be
        reached, it automatically uses the same quadratic calculation
        in the browser instead of stopping with “Failed to fetch.”
      </p>
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
          <h2>
            {optimizationScope === 'specific'
              ? 'Recommended discount for specific selection'
              : `Recommended discount by ${geographyLabelLower()}`}
          </h2>
        </div>

        <div class="results-controls">
          <label>
            <span>Sort recommended discount</span>

            <select bind:value={sortDirection}>
              <option value="ascending">
                Decrease → increase
              </option>
              <option value="descending">
                Increase → decrease
              </option>
            </select>
          </label>

          <label>
            <span>Inspect segment</span>

            <select bind:value={selectedKey}>
              {#each sortedModels as model}
                <option value={model.key}>
                  {model.region} — {model.department}
                </option>
              {/each}
            </select>
          </label>
        </div>
      </div>

      <div class="recommendation-table">
        <table>
          <thead>
            <tr>
              <th>{geographyLabel()}</th>
              <th>Department</th>
              <th>Observations</th>
              <th>Historical discount</th>
              <th>Recommended discount</th>
              <th>Predicted improvement</th>
              <th>R²</th>
              <th>Confidence</th>
            </tr>
          </thead>

          <tbody>
            {#each sortedModels as model}
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
              <span>Historical discount</span>
              <strong>
                {selectedModel.averageDiscount.toFixed(1)}%
              </strong>
              <small>Historical median discount</small>
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
              <small>Per order versus historical discount</small>
            </article>

            <article>
              <span>Model R²</span>
              <strong>
                {selectedModel.rSquared.toFixed(3)}
              </strong>
              <small>Explained profit variation</small>
            </article>

            <article>
              <span>RMSE</span>
              <strong>
                {money(selectedModel.rmse)}
              </strong>
              <small>Typical prediction error</small>
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
                  role="img"
                  aria-label={`Observed order: discount ${observation.discount.toFixed(2)} percent; actual profit ${money(observation.profit)}; predicted profit ${money(observation.predicted)}; residual ${money(observation.profit - observation.predicted)}`}
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
        {geographyLabelLower()} × department discount recommendations.
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
  .settings select,
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

  .fit-button:disabled {
    cursor: wait;
    opacity: 0.65;
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

  .results-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(220px, 1fr));
    gap: 12px;
    min-width: min(640px, 58vw);
  }

  .results-controls label {
    min-width: 0;
  }

  .results-controls label span {
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
    grid-template-columns: repeat(6, 1fr);
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

    .results-controls {
      grid-template-columns: 1fr;
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


  .model-card select {
    width: 100%;
    min-height: 39px;
    margin: 6px 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 9px;
    background: #ffffff;
    padding: 0 10px;
    color: #000080;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .input-heading-row {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
  }

  .input-heading-row > div > span {
    color: #e97800;
    font-size: 0.63rem;
    font-weight: 850;
    letter-spacing: 0.11em;
  }

  .input-heading-row h2 {
    margin: 4px 0 0;
    color: #000080;
    font-size: 1.05rem;
  }

  .input-mode-select {
    min-width: 245px;
  }

  .input-mode-select > span,
  .specific-fields label > span,
  .manual-fields label > span,
  .manual-observations > span {
    display: block;
    margin-bottom: 7px;
    color: #555162;
    font-size: 0.69rem;
    font-weight: 750;
  }

  .input-mode-select select,
  .specific-fields select,
  .manual-fields input {
    width: 100%;
    min-height: 42px;
    border: 1px solid #d9d8e3;
    border-radius: 9px;
    background: #ffffff;
    padding: 0 11px;
    color: #242130;
    font: inherit;
  }

  .secondary-action {
    min-height: 40px;
    border: 1px solid #d8d7e1;
    border-radius: 9px;
    background: #ffffff;
    padding: 0 14px;
    color: #000080;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 800;
    cursor: pointer;
  }

  .specific-fields,
  .manual-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #e7e6ef;
  }

  .manual-observations {
    display: block;
    margin-top: 15px;
  }

  .api-note {
    margin: 13px 0 0;
    color: #777382;
    font-size: 0.65rem;
    line-height: 1.45;
  }

  @media (max-width: 720px) {
    .input-heading-row {
      align-items: stretch;
      flex-direction: column;
    }

    .input-mode-select {
      min-width: 0;
    }

    .specific-fields,
    .manual-fields {
      grid-template-columns: 1fr;
    }
  }

</style>
