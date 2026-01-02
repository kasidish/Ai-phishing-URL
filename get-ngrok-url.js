const http = require('http');

function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.tunnels && json.tunnels.length > 0) {
            const httpsUrl = json.tunnels.find(t => t.proto === 'https');
            if (httpsUrl) {
              resolve(httpsUrl.public_url);
            } else {
              resolve(json.tunnels[0].public_url);
            }
          } else {
            reject(new Error('No tunnels found'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

getNgrokUrl()
  .then(url => {
    console.log('\nYour public URL is:');
    console.log('   ' + url);
    console.log('\nYou can share this URL with others!');
    console.log('   Example: ' + url + '/analyze');
    console.log('\nNote: First-time visitors may see a warning page');
    console.log('   They need to click "Visit Site" to continue\n');
  })
  .catch(error => {
    console.error('Error getting ngrok URL:', error.message);
    console.log('\nMake sure:');
    console.log('   1. ngrok is running (ngrok http 3000)');
    console.log('   2. Server is running (node server.js)');
    console.log('   3. Check ngrok web interface at http://127.0.0.1:4040\n');
  });

