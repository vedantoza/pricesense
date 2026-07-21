export type ProductType = 'Entire Catalog' | 'haircare' | 'skincare' | 'cosmetics';

export type RegressionModel = {
  label: ProductType;
  slope: number;
  intercept: number;
  r2: number;
  observations: number;
};

export const models: Record<ProductType, RegressionModel> = {
  'Entire Catalog': {
    label: 'Entire Catalog',
    slope: -0.1295173438,
    intercept: 479.4808275,
    r2: 0.000267596,
    observations: 100
  },
  haircare: {
    label: 'haircare',
    slope: 0.8487087146,
    intercept: 421.3495101,
    r2: 0.035611274,
    observations: 34
  },
  skincare: {
    label: 'skincare',
    slope: 3.8257412918,
    intercept: 288.8710669,
    r2: 0.210067647,
    observations: 40
  },
  cosmetics: {
    label: 'cosmetics',
    slope: -7.8952142636,
    intercept: 853.1839715,
    r2: 0.592981698,
    observations: 26
  }
};

export const productTypes = Object.keys(models) as ProductType[];

export function predictUnits(productType: ProductType, futurePrice: number): number {
  const model = models[productType];
  return Math.max(0, model.intercept + model.slope * futurePrice);
}

export function confidenceLabel(r2: number): 'Low' | 'Moderate' | 'Strong' {
  if (r2 >= 0.5) return 'Strong';
  if (r2 >= 0.2) return 'Moderate';
  return 'Low';
}
