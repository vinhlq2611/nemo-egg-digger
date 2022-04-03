import puppeteer, { Browser, Page } from "puppeteer";
import dotenv from 'dotenv';
import AccountService from '../database/Service/AccountServices'
import EvaluateFunction from './EvaluateFunction';
import JobService from "src/database/Service/JobService";
dotenv.config();

const { HEADLESS } = process.env;
const requestResourceType = ['image', 'font']
export class NimoGifter {
  browers: Browser[] = [];
  browser: Browser | null = null;
  HOST_NAME = 'https://www.nimo.tv';
  DIRECT_URL = `${this.HOST_NAME}/game/185`;
  mainPage: Page | null = null
  listIgnore: string[] = [];
  dataDir = './data';
  init = async (username: string = '0387976385', password: string = 'pewpewabcabc111', proxy: any) => {
    let authenArgs = proxy.host + ":" + proxy.port;
    this.browser = await puppeteer.launch({
      headless: HEADLESS == "true" ? true : false,
      handleSIGINT: true,
      handleSIGHUP: true,
      handleSIGTERM: true,
      args: [
        '--window-size=1920,1080',
        '--proxy-server=' + authenArgs,
        // Use proxy for localhost URLs
        '--proxy-bypass-list=<-loopback>',
      ],
      // args: [
      //   '--no-sandbox',
      //   '--disable-setuid-sandbox',
      //   "--incognito",
      //   "--no-zygote",
      //   // "--single-process"
      // ],
    });
    this.browers.push(this.browser);
    this.mainPage = await this.browser.newPage();
    this.mainPage.setDefaultNavigationTimeout(120000);

    await this.mainPage.authenticate({
      username: proxy.username,
      password: proxy.password
    })

    await this.mainPage.setViewport({
      width: 1500,
      height: 1000
    });
    const cookies = await this.getCookie(username, password);
    for (const cookie of cookies) {
      this.mainPage.setCookie(cookie);
    }
    await this.mainPage.goto(this.DIRECT_URL) + '/game/185';
    // await this.mainPage.goto("https://httpbin.org/ip")
    await this.login(username, password);
    // await this.autoScroll();
  }

  reloadMainPage = async () => {
    if (!this.mainPage) throw new Error(`Open ${this.DIRECT_URL} first`)
    await this.mainPage.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
    await this.autoScroll();
  }

  login = async (username: string = '', password: string = '') => {
    if (!this.mainPage) throw new Error(`Open ${this.DIRECT_URL} first`)
    const element = await this.mainPage.waitForSelector('.nimo-btn-group.reg-login-btn', { timeout: 3000 }).catch(err => console.log("Check login button Fail: ", err.message));
    if (element) {
      const isLogin = await this.mainPage.evaluate(EvaluateFunction.checkLogin)
      if (isLogin) {
        await this.mainPage.waitForSelector('input.phone-number-input', { timeout: 5000 });
        await this.mainPage.type('input.phone-number-input', username);
        await this.mainPage.type('input[type=password]', password);
        await this.mainPage.waitForSelector('button.nimo-login-body-button', { timeout: 5000 });
        await this.mainPage.click('button.nimo-login-body-button');
        await this.mainPage.waitForTimeout(10000);
        // await this.mainPage.waitForNavigation({waitUntil: 'load'});
        await AccountService.createNewAccount({ username: username, password: password })
        await this.setCookie(username);
      }
    }

    await this.mainPage.click('.nimo-header-c-country-entry');
    // await this.mainPage.waitForSelector('.CountryList__item', { timeout: 5000 });
    await this.mainPage.waitForTimeout(1000);
    await this.mainPage.click('.CountryList__item[title="Global"]');

  }


  logTime = () => {
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = '<' + date + ' ' + time + '>';
    return dateTime
  }

  takeGift = async (index: number, thread: number, proxy: any, link?: string) => {
    console.log(`[${index} - ${thread}] ${this.logTime()} Open New Tab: `, link)
    if (!link) return
    if (!this.browser) throw new Error('Not found browser');
    let authenArgs = proxy.host + ":" + proxy.port;
    const cookies = await this.mainPage!.cookies();
    const browser = await puppeteer.launch({
      headless: HEADLESS == "true" ? true : false,
      handleSIGINT: true,
      handleSIGHUP: true,
      handleSIGTERM: true,
      args: [
        '--window-size=1920,1080',
        '--proxy-server=' + authenArgs,
        // Use proxy for localhost URLs
        '--proxy-bypass-list=<-loopback>',
      ],

    });
    this.browers.push(browser);
    const [page] = await browser.pages();
    await page.setRequestInterception(true);
    await page.authenticate({
      username: proxy.username,
      password: proxy.password
    })
    page.on('request', (request) => {
      if (requestResourceType.indexOf(request.resourceType()) !== -1) {
        request.abort();
      } else {
        request.continue();
      }
    });
    for (const cookie of cookies) {
      page.setCookie(cookie);
    }
    await page.setViewport({
      width: 1200,
      height: 800
    });
    page.setDefaultNavigationTimeout(120000);
    await page.goto(`${link}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(async err => {
      console.log("Navigation Fail: ", err.message);
      await browser.close()
    });
    await page.waitForTimeout(25000);
    console.log(`[${index} - ${thread}] ${this.logTime()} Bắt đầu vòng 1 tại `, link)
    let evaluateEgg = await page.evaluate(EvaluateFunction.handleOpenEgg);
    let beforeEgg = evaluateEgg.eggLeft
    while (evaluateEgg.hasEgg && evaluateEgg.delayTime) {
      if (beforeEgg != evaluateEgg.eggLeft) {
        console.log(`[${index} - ${thread}] ${this.logTime()} Kết quả vòng trước `, link + " la : ", evaluateEgg)
      }
      await page.waitForTimeout(evaluateEgg.delayTime * 1000 + 4000)
      evaluateEgg = await page.evaluate(EvaluateFunction.handleOpenEgg)
        .catch(err => {
          console.log("Evaluate Egg Fail: ", err.message);
          return { hasEgg: false, eggLeft: 0 }
        });
    }
    console.log("Kết quả vòng cuối ", evaluateEgg)
    // this.listIgnore.splice(this.listIgnore.indexOf(link), 1);
    await JobService.clearJobList(link);
    await browser.close();

  }


  autoScroll = async () => {
    if (!this.mainPage) throw new Error(`Open ${this.DIRECT_URL} first`);
    await this.mainPage.evaluate(EvaluateFunction.autoScroll);
  }

  closeAllBrowers = async () => {
    for await (const br of this.browers) {
      br.close();
    }
  }

  setCookie = async (username: string) => {
    if (!this.mainPage) throw new Error('Not found mainPage');
    const cookies = await this.mainPage!.cookies();
    await AccountService.updateCookie({ username, cookies })
    return cookies;
  }

  getCookie = async (username: string, password: string) => {
    let result = await AccountService.find({ username, password })
    let account = result[0] && result[0].cookies ? result[0] : { cookies: [] }
    return account?.cookies
  }

}

