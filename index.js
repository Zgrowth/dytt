const puppeteer = require('puppeteer');
const AV = require('leancloud-storage');

const typeText = '喜剧';
const limit = 20;
const isDebugger = false;

// 初始化 LeanCloud 应用
AV.init({
  appId: process.env.appId, // 替换为你的 App ID
  appKey: process.env.appKey, // 替换为你的 App Key
  serverURL: "https://cn-n1-console-api.leancloud.cn", // 替换为你的 Server URL
});

const start = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const browser = await puppeteer.launch({ headless: !isDebugger });
      const page = await browser.newPage();
      console.log('🍉🍉🍉🍉🍉🍉🍉🍉1');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto('https://dytt.dytt8.net/');
      await page.waitForNavigation({ waitUntil: 'networkidle0' }); // 等待页面导航结束
      // 找到搜索框输入文本后搜索
      await page.focus('.searchl input');
      await page.type('.searchl input', typeText, { delay: 100 });
      await page.click('.searchr input');
      // await page.waitForNavigation({ waitUntil: 'networkidle0' }); // 等待页面导航结束
      await page.waitForSelector('#header ul table');
      console.log('🍉🍉🍉🍉🍉🍉🍉🍉2');
      // 用于存放所有详细信息
      const itemsDetails = [];
      let usePage = page;
      // 循环页数获取每页下的电影
      for (let index = 0; index < limit; index++) {
        // 第一页直接用当前page
        if (index === 0) {
          await getCurPageMovie({
            page,
            browser,
            itemsDetails,
          });
        } else {
          // 新开页面用于下一页
          const newItemPage = await browser.newPage();
          // 获取到下一页的href
          const curHref = await usePage.evaluate(() => {
            function findTextBySelector(selector, text) {
              const nodeList = document.querySelectorAll(selector);
              return Array.from(nodeList).find(node => node.innerText === text);
            }
            const nextEle = findTextBySelector('table a', '下一页');
            return nextEle.href;
          });
          usePage.close();
          console.log('🍉🍉🍉🍉🍉🍉🍉🍉4 curHref:', curHref);
          await newItemPage.goto(curHref, { waitUntil: 'networkidle2' });
          await sleep(2000);
          await getCurPageMovie({
            page: newItemPage,
            browser,
            itemsDetails,
          });
          usePage = newItemPage;
        }
      }
      await browser.close();
      resolve(itemsDetails);
    } catch (error) {
      reject(error);
    }
  })
}

async function uploadArrayAsJSON(array, fileName) {
  // 将对象数组转换为 JSON 字符串
  const jsonContent = JSON.stringify(array);

  // 将 JSON 字符串转换为 Buffer
  const buffer = Buffer.from(jsonContent, 'utf-8');

  // 创建 LeanCloud File 实例
  const avFile = new AV.File(fileName, buffer, 'application/json');

  try {
    // 上传到 LeanCloud
    const savedFile = await avFile.save();
    console.log('JSON file uploaded:', savedFile.url());
  } catch (error) {
    // 上传失败，处理错误
    console.error('Error uploading JSON file:', error);
  }
}

// 统一封装的获取当前页下的电影信息
async function getCurPageMovie({ page, browser, itemsDetails }) {
  try {
    // 使用page.$$方法根据类名获取所有匹配的元素
    const elements = await page.$$('#header ul table');
    // 长度减1是因为最后一个是分页器
    for (let index = 0; index < elements.length - 1; index++) {
      const aEle = await page.$(`#header ul table:nth-child(${index + 1}) a`);
      const { href, title } = await page.evaluate(el => {
        return { href: el.href, title: el.innerText };
      }, aEle);
      console.log('🍉🍉🍉🍉🍉🍉🍉🍉3 aEle:', href);
      // 2. 对于每个链接，创建一个新页面
      const newItemPage = await browser.newPage();
      // 3. 导航到链接指向的地址
      await newItemPage.goto(href, { waitUntil: 'networkidle2' });
      await sleep(2000);
      // 4. 提取所需信息
      const itemDetails = await newItemPage.evaluate(getMovieDetailInfo);
      itemsDetails.push({
        ...itemDetails,
        title,
      });
      // 5. 关闭新页面
      await newItemPage.close();
    }
  } catch (err) {
    console.log('getCurPageMovie error:', err || err.message);
  }
}

// 获取指定电影页面的详细信息字段
function getMovieDetailInfo() {
  const result = {};
  try {
    const textArr = document.querySelector('#Zoom').innerText.replace(/\n/g, '').split('◎');
    textArr.forEach(item => {
      if (item) {
        const fieldText = item.substr(0, 4);
        result[fieldText] = item.replace(fieldText, '');
      }
    });
    result.magnet = document.querySelector('#Zoom a').href;
  } catch(err) {
    console.log('getMovieDetailInfo error:', err, document.querySelector('#Zoom'));
  }
  return result;
}

function sleep(timeout) {
  return new Promise((resolve,reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  })
}

function getCurrentDateFormatted() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

start().then(res => {
  console.log(res);
  uploadArrayAsJSON(res, `movie-${getCurrentDateFormatted()}.json`);
})
