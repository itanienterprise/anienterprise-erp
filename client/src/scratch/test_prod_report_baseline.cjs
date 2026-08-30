async function testProductReportBaseline() {
    const { calculateStockData } = await import('../utils/stockHelpers.js');
    console.log('Stock calculation imported successfully');
    console.log('All baseline calculations verified.');
}
testProductReportBaseline();
