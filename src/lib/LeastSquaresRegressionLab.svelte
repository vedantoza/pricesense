<script lang="ts">
  type Point = {
    id: number;
    x: number;
    y: number;
    predicted: number;
    residual: number;
    squaredResidual: number;
  };

  const width = 760;
  const height = 420;

  const padding = {
    left: 70,
    right: 30,
    top: 30,
    bottom: 60
  };

  const ticks = [0, 1, 2, 3, 4, 5];

  let rawData = '';
  let xLabel = 'Independent variable';
  let yLabel = 'Dependent variable';
  let errorMessage = '';

  let points: Point[] = [];
  let hoveredPoint: Point | null = null;

  let intercept = 0;
  let slope = 0;
  let sse = 0;
  let mse = 0;
  let rmse = 0;
  let rSquared = 0;

  let xMin = 0;
  let xMax = 1;
  let yMin = 0;
  let yMax = 1;

  $: plotWidth = width - padding.left - padding.right;
  $: plotHeight = height - padding.top - padding.bottom;

  function parseRows(): Array<{ x: number; y: number }> {
    const rows: Array<{ x: number; y: number }> = [];

    for (const line of rawData.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      const values = trimmed.split(/[,\t; ]+/);

      if (values.length < 2) continue;

      const x = Number(values[0]);
      const y = Number(values[1]);

      // Automatically ignores headings such as x,y.
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      rows.push({ x, y });
    }

    return rows;
  }

  function fitLeastSquares(): void {
    errorMessage = '';

    const rows = parseRows();

    if (rows.length < 3) {
      points = [];
      errorMessage =
        'Enter at least three valid x and y observations.';
      return;
    }

    const meanX =
      rows.reduce((total, row) => total + row.x, 0) / rows.length;

    const meanY =
      rows.reduce((total, row) => total + row.y, 0) / rows.length;

    const denominator = rows.reduce(
      (total, row) => total + (row.x - meanX) ** 2,
      0
    );

    if (denominator === 0) {
      points = [];
      errorMessage =
        'The independent-variable values cannot all be identical.';
      return;
    }

    const numerator = rows.reduce(
      (total, row) =>
        total + (row.x - meanX) * (row.y - meanY),
      0
    );

    slope = numerator / denominator;
    intercept = meanY - slope * meanX;

    points = rows.map((row, index) => {
      const predicted = intercept + slope * row.x;
      const residual = row.y - predicted;

      return {
        id: index + 1,
        x: row.x,
        y: row.y,
        predicted,
        residual,
        squaredResidual: residual ** 2
      };
    });

    sse = points.reduce(
      (total, point) => total + point.squaredResidual,
      0
    );

    mse = sse / Math.max(points.length - 2, 1);
    rmse = Math.sqrt(mse);

    const totalSumSquares = rows.reduce(
      (total, row) => total + (row.y - meanY) ** 2,
      0
    );

    rSquared =
      totalSumSquares === 0 ? 1 : 1 - sse / totalSumSquares;

    const rawXMin = Math.min(...rows.map((row) => row.x));
    const rawXMax = Math.max(...rows.map((row) => row.x));

    const rawYMin = Math.min(
      ...rows.map((row) => row.y),
      intercept + slope * rawXMin,
      intercept + slope * rawXMax
    );

    const rawYMax = Math.max(
      ...rows.map((row) => row.y),
      intercept + slope * rawXMin,
      intercept + slope * rawXMax
    );

    const xMargin = Math.max((rawXMax - rawXMin) * 0.08, 1);
    const yMargin = Math.max((rawYMax - rawYMin) * 0.08, 1);

    xMin = rawXMin - xMargin;
    xMax = rawXMax + xMargin;
    yMin = rawYMin - yMargin;
    yMax = rawYMax + yMargin;
  }

  function clearData(): void {
    rawData = '';
    points = [];
    hoveredPoint = null;
    errorMessage = '';

    intercept = 0;
    slope = 0;
    sse = 0;
    mse = 0;
    rmse = 0;
    rSquared = 0;
  }

  function scaleX(value: number): number {
    return (
      padding.left +
      ((value - xMin) / Math.max(xMax - xMin, Number.EPSILON)) *
        plotWidth
    );
  }

  function scaleY(value: number): number {
    return (
      padding.top +
      plotHeight -
      ((value - yMin) / Math.max(yMax - yMin, Number.EPSILON)) *
        plotHeight
    );
  }

  function tickValue(
    minimum: number,
    maximum: number,
    tick: number
  ): number {
    return minimum + ((maximum - minimum) * tick) / 5;
  }

  function exact(value: number): string {
    return new Intl.NumberFormat('en-CA', {
      maximumFractionDigits: 8
    }).format(value);
  }
</script>

<section class="least-squares-lab">
  <div class="heading">
    <div>
      <span>LEAST SQUARES REGRESSION</span>
      <h2>Line of best fit</h2>
      <p>
        The least squares method selects the intercept and slope that
        minimize the sum of the squared vertical residuals.
      </p>
    </div>

    <div class="objective">
      <small>Objective function</small>
      <strong>Minimize Σ(yᵢ − ŷᵢ)²</strong>
      <span>ŷ = b₀ + b₁x</span>
    </div>
  </div>

  <div class="workspace">
    <aside class="input-panel">
      <div class="label-grid">
        <label>
          <span>X-axis label</span>
          <input bind:value={xLabel} />
        </label>

        <label>
          <span>Y-axis label</span>
          <input bind:value={yLabel} />
        </label>
      </div>

      <label>
        <span>Paste two-column observations</span>
        <textarea
          bind:value={rawData}
          rows="14"
          placeholder="x,y&#10;x,y&#10;x,y"
        ></textarea>
      </label>

      <small class="format-note">
        Use a comma, tab, semicolon, or space between values. Put each
        observation on a new line.
      </small>

      {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
      {/if}

      <div class="buttons">
        <button class="primary" onclick={fitLeastSquares}>
          Calculate least squares line
        </button>

        <button class="secondary" onclick={clearData}>
          Clear
        </button>
      </div>
    </aside>

    <div class="results-panel">
      {#if points.length > 0}
        <div class="metrics">
          <article>
            <span>Intercept b₀</span>
            <strong>{intercept.toFixed(4)}</strong>
          </article>

          <article>
            <span>Slope b₁</span>
            <strong>{slope.toFixed(4)}</strong>
          </article>

          <article>
            <span>SSE</span>
            <strong>{sse.toFixed(4)}</strong>
          </article>

          <article>
            <span>MSE</span>
            <strong>{mse.toFixed(4)}</strong>
          </article>

          <article>
            <span>RMSE</span>
            <strong>{rmse.toFixed(4)}</strong>
          </article>

          <article>
            <span>R²</span>
            <strong>{rSquared.toFixed(4)}</strong>
          </article>
        </div>

        <div class="equation">
          <span>Least squares regression line</span>

          <strong>
            ŷ = {intercept.toFixed(4)}
            {slope >= 0 ? '+' : '−'}
            {Math.abs(slope).toFixed(4)}x
          </strong>
        </div>

        <div class="chart">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Least squares scatter plot with residual lines"
          >
            {#each ticks as tick}
              {@const yValue = tickValue(yMin, yMax, tick)}
              {@const yPosition = scaleY(yValue)}

              <line
                x1={padding.left}
                y1={yPosition}
                x2={width - padding.right}
                y2={yPosition}
                class="grid-line"
              />

              <text
                x={padding.left - 10}
                y={yPosition + 4}
                text-anchor="end"
                class="tick-label"
              >
                {yValue.toFixed(1)}
              </text>
            {/each}

            {#each ticks as tick}
              {@const xValue = tickValue(xMin, xMax, tick)}
              {@const xPosition = scaleX(xValue)}

              <line
                x1={xPosition}
                y1={padding.top}
                x2={xPosition}
                y2={height - padding.bottom}
                class="grid-line"
              />

              <text
                x={xPosition}
                y={height - padding.bottom + 22}
                text-anchor="middle"
                class="tick-label"
              >
                {xValue.toFixed(1)}
              </text>
            {/each}

            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              class="axis"
            />

            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              class="axis"
            />

            <line
              x1={scaleX(xMin)}
              y1={scaleY(intercept + slope * xMin)}
              x2={scaleX(xMax)}
              y2={scaleY(intercept + slope * xMax)}
              class="best-fit-line"
            />

            {#each points as point}
              <line
                x1={scaleX(point.x)}
                y1={scaleY(point.y)}
                x2={scaleX(point.x)}
                y2={scaleY(point.predicted)}
                class="residual-line"
              />

              <circle
                cx={scaleX(point.x)}
                cy={scaleY(point.predicted)}
                r="4"
                class="fitted-point"
              />

              <circle
                cx={scaleX(point.x)}
                cy={scaleY(point.y)}
                r={hoveredPoint?.id === point.id ? 9 : 6}
                class="observed-point"
                role="img"
                aria-label={`Observation ${point.id}: ${xLabel} ${exact(point.x)}; ${yLabel} ${exact(point.y)}; predicted value ${exact(point.predicted)}; residual ${exact(point.residual)}; squared residual ${exact(point.squaredResidual)}`}
                onpointerenter={() => (hoveredPoint = point)}
                onpointerleave={() => (hoveredPoint = null)}
              />
            {/each}

            <text
              x={padding.left + plotWidth / 2}
              y={height - 10}
              text-anchor="middle"
              class="axis-label"
            >
              {xLabel}
            </text>

            <text
              x="18"
              y={padding.top + plotHeight / 2}
              text-anchor="middle"
              transform={`rotate(-90 18 ${padding.top + plotHeight / 2})`}
              class="axis-label"
            >
              {yLabel}
            </text>
          </svg>

          {#if hoveredPoint}
            <div class="tooltip">
              <strong>Observation #{hoveredPoint.id}</strong>

              <div>
                <span>{xLabel}</span>
                <b>{exact(hoveredPoint.x)}</b>
              </div>

              <div>
                <span>{yLabel}</span>
                <b>{exact(hoveredPoint.y)}</b>
              </div>

              <div>
                <span>Predicted ŷ</span>
                <b>{exact(hoveredPoint.predicted)}</b>
              </div>

              <div>
                <span>Residual</span>
                <b>{exact(hoveredPoint.residual)}</b>
              </div>

              <div>
                <span>Squared residual</span>
                <b>{exact(hoveredPoint.squaredResidual)}</b>
              </div>
            </div>
          {/if}
        </div>

        <div class="legend">
          <span><i class="observed-key"></i> Observed value</span>
          <span><i class="fitted-key"></i> Fitted value</span>
          <span><i class="residual-key"></i> Residual</span>
          <span><i class="line-key"></i> Least squares line</span>
        </div>

        <div class="residual-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{xLabel}</th>
                <th>{yLabel}</th>
                <th>Predicted</th>
                <th>Residual</th>
                <th>Residual²</th>
              </tr>
            </thead>

            <tbody>
              {#each points as point}
                <tr>
                  <td>{point.id}</td>
                  <td>{exact(point.x)}</td>
                  <td>{exact(point.y)}</td>
                  <td>{exact(point.predicted)}</td>
                  <td>{exact(point.residual)}</td>
                  <td>{exact(point.squaredResidual)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="empty">
          <span>⌁</span>
          <h3>No observations loaded</h3>
          <p>
            Paste your data to calculate the least squares regression
            line and residual values.
          </p>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .least-squares-lab {
    margin-bottom: 24px;
    padding: 24px;
    border: 1px solid #e7e7ef;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 10px 35px rgba(37, 31, 61, 0.06);
  }

  .heading {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .heading > div:first-child > span {
    color: #e97800;
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
  }

  h2 {
    margin: 6px 0;
    color: #000080;
    font-size: 1.5rem;
  }

  .heading p {
    max-width: 650px;
    margin: 0;
    color: #6d6978;
    font-size: 0.78rem;
    line-height: 1.55;
  }

  .objective {
    min-width: 245px;
    padding: 14px 16px;
    border: 1px solid #ffd4a9;
    border-radius: 12px;
    background: #fff7ef;
  }

  .objective small,
  .objective strong,
  .objective span {
    display: block;
  }

  .objective small {
    color: #776d64;
    font-size: 0.65rem;
  }

  .objective strong {
    margin: 6px 0;
    color: #000080;
  }

  .objective span {
    color: #c65f00;
    font-size: 0.75rem;
    font-weight: 750;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(300px, 0.65fr) minmax(0, 1.35fr);
    gap: 20px;
  }

  .input-panel,
  .results-panel {
    padding: 18px;
    border: 1px solid #ecebf2;
    border-radius: 15px;
    background: #fbfbfe;
  }

  .label-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 11px;
  }

  label {
    display: block;
    margin-bottom: 15px;
  }

  label span {
    display: block;
    margin-bottom: 7px;
    color: #555162;
    font-size: 0.72rem;
    font-weight: 750;
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid #d9d8e3;
    border-radius: 10px;
    background: #ffffff;
    padding: 11px 12px;
    color: #242130;
    font: inherit;
    outline: none;
  }

  input:focus,
  textarea:focus {
    border-color: #ff8d21;
    box-shadow: 0 0 0 3px rgba(255, 141, 33, 0.13);
  }

  textarea {
    min-height: 250px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .format-note {
    display: block;
    margin: -7px 0 15px;
    color: #85818f;
    font-size: 0.67rem;
  }

  .buttons {
    display: flex;
    gap: 9px;
  }

  button {
    min-height: 42px;
    border-radius: 9px;
    padding: 0 14px;
    font: inherit;
    font-size: 0.73rem;
    font-weight: 800;
    cursor: pointer;
  }

  .primary {
    border: 0;
    background: #000080;
    color: white;
  }

  .secondary {
    border: 1px solid #d7d5df;
    background: white;
    color: #4f4b5b;
  }

  .error-message {
    margin-bottom: 13px;
    padding: 11px;
    border-radius: 9px;
    background: #fff0ee;
    color: #a33226;
    font-size: 0.74rem;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .metrics article {
    padding: 10px;
    border: 1px solid #e8e7ef;
    border-radius: 9px;
    background: white;
  }

  .metrics span,
  .metrics strong {
    display: block;
  }

  .metrics span {
    color: #787483;
    font-size: 0.61rem;
  }

  .metrics strong {
    margin-top: 5px;
    color: #000080;
    font-size: 0.86rem;
  }

  .equation {
    margin-bottom: 12px;
    padding: 11px 13px;
    border-left: 4px solid #ff8d21;
    border-radius: 4px 9px 9px 4px;
    background: #fff7ef;
  }

  .equation span,
  .equation strong {
    display: block;
  }

  .equation span {
    color: #7b7167;
    font-size: 0.64rem;
  }

  .equation strong {
    margin-top: 5px;
    color: #000080;
  }

  .chart {
    position: relative;
    overflow-x: auto;
    background: white;
    border-radius: 12px;
  }

  svg {
    display: block;
    width: 100%;
    min-width: 620px;
  }

  .grid-line {
    stroke: #ecebf2;
  }

  .axis {
    stroke: #aaa7b4;
    stroke-width: 1.3;
  }

  .best-fit-line {
    stroke: #000080;
    stroke-width: 3.5;
  }

  .residual-line {
    stroke: #ff8d21;
    stroke-width: 2;
    stroke-dasharray: 5 4;
  }

  .observed-point {
    fill: #000080;
    stroke: white;
    stroke-width: 2;
    cursor: crosshair;
  }

  .fitted-point {
    fill: white;
    stroke: #ff8d21;
    stroke-width: 2.5;
  }

  .tick-label {
    fill: #7c7888;
    font-size: 10px;
  }

  .axis-label {
    fill: #454151;
    font-size: 11px;
    font-weight: 700;
  }

  .tooltip {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 220px;
    padding: 13px;
    border: 1px solid #d8d7e3;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: 0 12px 30px rgba(20, 20, 50, 0.18);
    pointer-events: none;
  }

  .tooltip > strong {
    display: block;
    margin-bottom: 9px;
    color: #000080;
    font-size: 0.78rem;
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
    color: #272431;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 12px 0;
    color: #686473;
    font-size: 0.68rem;
  }

  .legend span {
    display: flex;
    align-items: center;
    gap: 6px;
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

  .fitted-key {
    width: 10px;
    height: 10px;
    border: 2px solid #ff8d21;
    border-radius: 50%;
    background: white;
  }

  .residual-key {
    width: 18px;
    border-top: 2px dashed #ff8d21;
  }

  .line-key {
    width: 18px;
    height: 3px;
    border-radius: 3px;
    background: #000080;
  }

  .residual-table {
    max-height: 270px;
    overflow: auto;
    border: 1px solid #ecebf2;
    border-radius: 10px;
    background: white;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.7rem;
  }

  th,
  td {
    padding: 9px;
    border-bottom: 1px solid #ecebf2;
    text-align: right;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  th {
    position: sticky;
    top: 0;
    background: #f4f3f8;
    color: #625e6e;
  }

  .empty {
    min-height: 500px;
    display: grid;
    place-items: center;
    align-content: center;
    text-align: center;
    color: #767281;
  }

  .empty > span {
    color: #ff8d21;
    font-size: 3rem;
  }

  .empty h3 {
    margin: 10px 0 5px;
    color: #000080;
  }

  .empty p {
    max-width: 420px;
    margin: 0;
    font-size: 0.77rem;
  }

  @media (max-width: 1100px) {
    .heading {
      flex-direction: column;
    }

    .objective {
      min-width: 0;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .metrics {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 650px) {
    .least-squares-lab {
      padding: 17px;
    }

    .label-grid,
    .metrics {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
