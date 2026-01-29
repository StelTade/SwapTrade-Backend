export async function validateMigrations(dataSource) {
  const hasPending = await dataSource.showMigrations();
  if (hasPending) {
    console.warn('⚠️ Pending migrations detected');
  }
}
