<script lang="ts">
  type Observation = {
    x: number;
    y: number;
    predicted: number;
    residual: number;
  };

  type RegressionResult = {
    slope: number;
    intercept: number;
    standardError: number;
    rSquared: number;
    observations: Observation[];
  };

  const width = 560;
  const height = 360;
  const padding = 55;

  const xValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const noisePattern = [
    -0.8, 0.5, -0.4, 0.9, -0.7, 0.4,
    -0.5, 0.8, -0.6, 0.3, -0.2, 0.7
  ];

  let smallVariation = 5;
  let largeVariation = 22;

  function createData(variation: number): Array<{ x: number; y: number }> {
    return xValues.map((x, index) => ({
      x,
      y: 25 + 7 * x + noisePattern[index] * variation
    }));
  }

  function calculateRegression(
    rows: Array<{ x: number; y: number }>
  ): RegressionResult {
    const n = rows.length;

    const meanX =
      rows.reduce((total, row) => total + row.x, 0) / n;

    const meanY =
      rows.reduce((total, row) => total + row.y, 0) / n;

    const denominator = rows.reduce(
      (total, row) => total + (row.x - meanX) ** 2,
      0
    );

    const numerator = rows.reduce(
      (total, row) =>
        total + (row.x - meanX) * (row.y - meanY),
      0
    );

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    const observations = rows.map((row) => {
      const predicted = intercept + slope * row.x;

      return {
        ...row,
        predicted,
        residual: row.y - predicted
      };
    });

    const sse = observations.reduce(
      (total, point) => total + point.residual ** 2,
      0
    );

    const standardError = Math.sqrt(sse / Math.max(n - 2, 1));

    const totalVariation = rows.reduce(
      (total, row) => total + (row.y - meanY) ** 2,
      0
    );

    const rSquared =
      totalVariation === 0 ? 1 : 1 - sse / totalVariation;

    return {
      slope,
      intercept,
      standardError,
      rSquared,
      observations
    };
  }

  $: smallResult = calculateRegression(createData(smallVariation));
  $: largeResult = calculateRegression(createData(largeVariation));

  $: allValues = [
    ...smallResult.observations.map((point) => point.y),
    ...largeResult.observations.map((point) => point.y)
  ];

  $: minimumY = Math.min(...allValues) - 10;
  $: maximumY = Math.max(...allValues) + 10;

  function scaleX(x: number): number {
    return padding + ((x - 1) / 11) * (width - padding * 2);
  }

  function scaleY(y: number): number {
    return (
      height -
      padding -
      ((y - minimumY) / (maximumY - minimumY)) *
        (height - padding * 2)
    );
  }
</script>

<section class="page">
  <header>
    <div>
      <span>REGRESSION PRECISION</span>
      <h1>Comparing Standard Errors</h1>
      <p>
        Compare small and large variation of observed y-values around
        their regression lines.
      </p>
    </div>

    <div class="formula">
      <small>Standard error of the estimate</small>
      <strong>sₑ = √[Σ(yᵢ − ŷᵢ)² ÷ (n − 2)]</strong>
    </div>
  </header>

  <div class="controls">
    <label>
      <span>Small variation: {smallVariation}</span>
      <input
        type="range"
        min="1"
        max="15"
        bind:value={smallVariation}
      />
    </label>

    <label>
      <span>Large variation: {largeVariation}</span>
      <input
        type="range"
        min="12"
        max="40"
        bind:value={largeVariation}
      />
    </label>
  </div>

  <div class="comparison">
    <article>
      <div class="card-heading">
        <div>
          <span>SMALL VARIATION</span>
          <h2>Observed values remain close to the regression line</h2>
        </div>

        <strong class="badge small">
          Small sₑ: {smallResult.standardError.toFixed(2)}
        </strong>
      </div>

      <div class="metrics">
        <span>R²: {smallResult.rSquared.toFixed(3)}</span>
        <span>
          ŷ = {smallResult.intercept.toFixed(2)}
          + {smallResult.slope.toFixed(2)}x
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`}>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          class="axis"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          class="axis"
        />

        <line
          x1={scaleX(1)}
          y1={scaleY(
            smallResult.intercept + smallResult.slope
          )}
          x2={scaleX(12)}
          y2={scaleY(
            smallResult.intercept + smallResult.slope * 12
          )}
          class="regression-line"
        />

        {#each smallResult.observations as point}
          <line
            x1={scaleX(point.x)}
            y1={scaleY(point.y)}
            x2={scaleX(point.x)}
            y2={scaleY(point.predicted)}
            class="residual"
          />

          <circle
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="8"
            class="point"
          >
            <title>
              x: {point.x}
              y: {point.y.toFixed(2)}
              predicted: {point.predicted.toFixed(2)}
              residual: {point.residual.toFixed(2)}
            </title>
          </circle>
        {/each}

        <text x={width - 35} y={height - 45} class="axis-label">x</text>
        <text x="30" y="45" class="axis-label">y</text>
      </svg>
    </article>

    <article>
      <div class="card-heading">
        <div>
          <span>LARGE VARIATION</span>
          <h2>Observed values vary widely from the regression line</h2>
        </div>

        <strong class="badge large">
          Large sₑ: {largeResult.standardError.toFixed(2)}
        </strong>
      </div>

      <div class="metrics">
        <span>R²: {largeResult.rSquared.toFixed(3)}</span>
        <span>
          ŷ = {largeResult.intercept.toFixed(2)}
          + {largeResult.slope.toFixed(2)}x
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`}>
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          class="axis"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          class="axis"
        />

        <line
          x1={scaleX(1)}
          y1={scaleY(
            largeResult.intercept + largeResult.slope
          )}
          x2={scaleX(12)}
          y2={scaleY(
            largeResult.intercept + largeResult.slope * 12
          )}
          class="regression-line"
        />

        {#each largeResult.observations as point}
          <line
            x1={scaleX(point.x)}
            y1={scaleY(point.y)}
            x2={scaleX(point.x)}
            y2={scaleY(point.predicted)}
            class="residual"
          />

          <circle
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="8"
            class="point"
          >
            <title>
              x: {point.x}
              y: {point.y.toFixed(2)}
              predicted: {point.predicted.toFixed(2)}
              residual: {point.residual.toFixed(2)}
            </title>
          </circle>
        {/each}

        <text x={width - 35} y={height - 45} class="axis-label">x</text>
        <text x="30" y="45" class="axis-label">y</text>
      </svg>
    </article>
  </div>

  <div class="summary">
    <article>
      <strong>Small standard error</strong>
      <p>
        The observations are concentrated close to the fitted regression
        line, so the typical prediction error is smaller.
      </p>
    </article>

    <article>
      <strong>Large standard error</strong>
      <p>
        The observations are more widely dispersed around the fitted
        regression line, so prediction uncertainty is greater.
      </p>
    </article>
  </div>
</section>

<style>
  .page {
    overflow: hidden;
    border: 1px solid #e3e4ef;
    border-radius: 22px;
    background: #f7f8fc;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 30px;
    padding: 30px;
    border-right: 14px solid #ff8d21;
    background: #000080;
    color: white;
  }

  header span {
    color: #ffc78e;
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
  }

  h1 {
    margin: 7px 0;
    font-size: clamp(2rem, 4vw, 3.7rem);
  }

  header p {
    margin: 0;
    color: #dedfff;
  }

  .formula {
    min-width: 310px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.1);
  }

  .formula small,
  .formula strong {
    display: block;
  }

  .formula strong {
    margin-top: 8px;
  }

  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    padding: 20px 25px;
    background: white;
  }

  .controls span {
    display: block;
    margin-bottom: 8px;
    color: #000080;
    font-size: 0.75rem;
    font-weight: 750;
  }

  .controls input {
    width: 100%;
    accent-color: #ff8d21;
  }

  .comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    padding: 25px;
  }

  .comparison article {
    padding: 20px;
    border: 1px solid #e4e4ed;
    border-radius: 17px;
    background: white;
  }

  .card-heading {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .card-heading span {
    color: #e97800;
    font-size: 0.64rem;
    font-weight: 850;
  }

  h2 {
    margin: 6px 0;
    color: #171725;
    font-size: 1.1rem;
  }

  .badge {
    align-self: flex-start;
    white-space: nowrap;
    padding: 9px 12px;
    border-radius: 999px;
    font-size: 0.72rem;
  }

  .badge.small {
    background: #e4f8ed;
    color: #087341;
  }

  .badge.large {
    background: #fff0e2;
    color: #b65300;
  }

  .metrics {
    display: flex;
    gap: 10px;
    margin: 13px 0;
  }

  .metrics span {
    padding: 8px 10px;
    border-radius: 8px;
    background: #f4f4f8;
    color: #000080;
    font-size: 0.69rem;
    font-weight: 700;
  }

  svg {
    display: block;
    width: 100%;
    min-width: 450px;
  }

  .axis {
    stroke: #161616;
    stroke-width: 2;
  }

  .regression-line {
    stroke: #000080;
    stroke-width: 3;
  }

  .residual {
    stroke: #ff8d21;
    stroke-width: 1.7;
    stroke-dasharray: 4 4;
  }

  .point {
    fill: #9d5d7c;
    stroke: white;
    stroke-width: 2;
    cursor: crosshair;
  }

  .axis-label {
    fill: #171725;
    font-size: 20px;
    font-weight: 800;
  }

  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    padding: 0 25px 25px;
  }

  .summary article {
    padding: 16px;
    border: 1px solid #e5e5ee;
    border-radius: 12px;
    background: white;
  }

  .summary strong {
    color: #000080;
  }

  .summary p {
    margin: 7px 0 0;
    color: #686474;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  @media (max-width: 1050px) {
    header {
      flex-direction: column;
    }

    .formula {
      min-width: 0;
    }

    .comparison {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 650px) {
    .controls,
    .summary {
      grid-template-columns: 1fr;
    }

    .comparison {
      padding: 16px;
    }
  }
</style>
