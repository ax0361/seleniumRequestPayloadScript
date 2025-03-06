const { Builder } = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const CDP = require('chrome-remote-interface');
const { writeFileSync } = require('fs');


(async function caputureNetworkRequests() {
  const options = new edge.Options();
  options.addArguments('--headless')
  options.addArguments('--remote-debugging-port=9222'); 

  const driver = await new Builder()
    .forBrowser('MicrosoftEdge')
    .setEdgeOptions(options)
    .build();

  try {
    const cdpClient = await CDP({ port: 9222 });
    await cdpClient.Network.enable();

    const requests = [];
    cdpClient.Network.requestWillBeSent((params) => {
      if(params?.request?.url?.includes("interact")){
        const data = JSON.parse(params.request.postData)?.events[0].xdm
        requests.push({xdm:data})
      }
    });

    await driver.get('https://www.business.att.com');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    writeFileSync('requests.json', JSON.stringify(requests, null, 4), 'utf-8')

    await cdpClient.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await driver.quit();
  }
})();