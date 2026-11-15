const http = require('http');

async function testEndpoint(q) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8080/api/search/semantic?q=' + encodeURIComponent(q), res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  const dairyProducts = await testEndpoint('dairy products');
  console.log('Query [dairy products]: totalMatches =', dairyProducts.totalMatches, 'data length =', dairyProducts.data?.length);

  const dairyFree = await testEndpoint('dairy-free products');
  console.log('Query [dairy-free products]: totalMatches =', dairyFree.totalMatches, 'data length =', dairyFree.data?.length);

  const mayContain = await testEndpoint('products that may contain milk');
  console.log('Query [products that may contain milk]: totalMatches =', mayContain.totalMatches, 'data length =', mayContain.data?.length);
})();
