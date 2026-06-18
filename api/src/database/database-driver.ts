export type DatabaseDriver = 'standard' | 'light';

export const getDatabaseDriver = (
  value = process.env.DB_DRIVER,
): DatabaseDriver =>
  value?.trim().toLowerCase() === 'light' ? 'light' : 'standard';

export const isStandardDatabaseDriver = (
  value = process.env.DB_DRIVER,
): boolean => getDatabaseDriver(value) === 'standard';

export const isLightDatabaseDriver = (value = process.env.DB_DRIVER): boolean =>
  getDatabaseDriver(value) === 'light';
