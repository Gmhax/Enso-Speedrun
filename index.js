require('dotenv').config();
const axios = require('axios');
const randomUseragent = require('random-useragent');
const { ethers } = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`             Enso Speedrun                    `);
    console.log(`---------------------------------------------${colors.reset}\n`);
  },
};

const DEFIDEX_URL = 'https://speedrun.enso.build/api/track-project-creation';
const NONCE_URL = 'https://enso.brianknows.org/api/auth/nonce';
const VERIFY_URL = 'https://enso.brianknows.org/api/auth/verify';
const ME_URL = 'https://enso.brianknows.org/api/auth/me';
const SEARCH_URL = 'https://enso.brianknows.org/api/search';
const DELAY_MS = 1000; 
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; 
const DEFIDEX_DAILY_LIMIT = 5;
const CHAT_DAILY_LIMIT = 5;
const PROJECT_TYPE = 'shortcuts-widget';
const KB_ID = 'b4393b93-e603-426d-8b9f-0af145498c92'; 
const CHAIN_ID = 1; 
const MAX_RETRIES = 3; 
const CHAT_RETRY_LIMIT = 3; 

const loadProxies = () => {
  if (!fs.existsSync('proxies.txt')) {
    logger.error('proxies.txt not found in the project root.');
    return [];
  }
  const proxies = fs.readFileSync('proxies.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  return proxies;
};

const parseProxy = (proxy) => {
  if (!proxy) return null;
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return proxy;
  }
  const [auth, hostPosrt] = proxy.includes('@') ? proxy.split('@') : ['', proxy];
  const [host, port] = hostPort.split(':');
  const [username, password] = auth ? auth.split(':') : ['', ''];
  const protocol = 'http';
  const proxyUrl = username && password
    ? `${protocol}://${username}:${password}@${host}:${port}`
    : `${protocol}://${host}:${port}`;
  return proxyUrl;
};

const loadAccounts = () => {
  const accounts = [];
  let i = 1;
  while (process.env[`PRIVATE_KEY_${i}`]) {
    const account = {
      privateKey: process.env[`PRIVATE_KEY_${i}`],
      userId: process.env[`USER_ID_${i}`],
      zealyUserId: process.env[`ZEALY_USER_ID_${i}`],
    };
    accounts.push(account);
    i++;
  }
  return accounts;
};

const isValidEthAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);
const isValidUUID = (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
const isValidPrivateKey = (pk) => /^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/.test(pk);

const validateAccount = (account, index) => {
  if (!account.privateKey) {
    logger.error(`PRIVATE_KEY_${index} is missing or empty in .env`);
    return false;
  }
  if (!isValidPrivateKey(account.privateKey)) {
    logger.error(`Invalid PRIVATE_KEY_${index} format in .env. Expected a 64-character hexadecimal string. Got: ${account.privateKey}`);
    return false;
  }
  if (!account.userId) {
    logger.error(`USER_ID_${index} is missing or empty in .env`);
    return false;
  }
  if (!isValidEthAddress(account.userId)) {
    logger.error(`Invalid USER_ID_${index} format in .env. Expected a valid Ethereum address. Got: ${account.userId}`);
    return false;
  }
  if (!account.zealyUserId) {
    logger.error(`ZEALY_USER_ID_${index} is missing or empty in .env`);
    return false;
  }
  if (!isValidUUID(account.zealyUserId)) {
    logger.error(`Invalid ZEALY_USER_ID_${index} format in .env. Expected a valid UUID. Got: ${account.zealyUserId}`);
    return false;
  }
  return true;
};

if (!fs.existsSync('.env')) {
  logger.error('Error: .env file not found in the project root.');
  process.exit(1);
}

const accounts = loadAccounts();
if (accounts.length === 0) {
  logger.error('No accounts found in .env. At least one account (PRIVATE_KEY_1, USER_ID_1, ZEALY_USER_ID_1) is required.');
  process.exit(1);
}

logger.banner();
accounts.forEach((account, index) => {
  if (validateAccount(account, index + 1)) {
    logger.info(`Validated account ${index + 1}:`);;
    logger.info(`USER_ID_${index + 1}: ${account.userId}`);
    logger.info(`ZEALY_USER_ID_${index + 1}: ${account.zealyUserId}\n`);
  } else {
    process.exit(1);
  }
});

const proxies = loadProxies();
logger.info(`Loaded ${proxies.length} proxies from proxies.txt\n`);

let currentProxyIndex = 0;

const getRandomProxy = () => {
  if (proxies.length === 0) return null;
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  const proxyUrl = parseProxy(proxies[currentProxyIndex]);
  logger.step(`Using proxy: ${proxyUrl.split('@')[1] || proxyUrl}`);
  return new HttpsProxyAgent(proxyUrl);
};

const RANDOM_QUERIES = [
  'What is Uniswap v4?',
  'How does decentralized finance work?',
  'What are the benefits of liquidity pools?',
  'Explain yield farming in DeFi.',
  'What is a decentralized exchange?',
  'How do smart contracts work?',
  'What is the role of oracles in DeFi?',
  'What are stablecoins and their use cases?',
  'How does staking work in Ethereum?',
  'What is the future of DeFi protocols?',
];

const generateProjectSlug = () => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return `myinsiders${randomString}.widget`;
};

const getHeaders = (isSearch = false, userId, brianToken = null) => {
  const headers = {
    accept: isSearch ? '*/*' : 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.7',
    'content-type': isSearch ? 'text/plain;charset=UTF-8' : 'application/json',
    priority: 'u=1, i',
    'sec-ch-ua': randomUseragent.getRandom(),
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-gpc': '1',
    Referer: isSearch
      ? `https://enso.brianknows.org/search?userId=${userId}`
      : 'https://speedrun.enso.build/create/de-fi/shortcuts-widget',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (isSearch) headers['x-enso-user-id'] = userId;
  if (brianToken) {
    headers.cookie = `brian-address=${userId}; brian-token=${brianToken}; ph_phc_NfMuib33NsuSeHbpu42Ng91vE5X6J1amefUiuVgwx5y_posthog={"distinct_id":"0196a6af-e55f-79aa-9eda-0bc979d7345e","$sesid":[1746600342091,"0196a97c-daff-7ede-b8ef-c6f03e5cb2e4",1746600254207],"$initial_person_info":{"r":"https://speedrun.enso.build/","u":"https://enso.brianknows.org/search?userId=${userId}"}}`;
  }
  return headers;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const showLoading = (msg) => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`${colors.cyan}[${frames[i++ % frames.length]}] ${msg}\r${colors.reset}`);
  }, 100);
  return () => clearInterval(interval);
};

async function getNonce(headers, retryCount = 0) {
  const stopLoading = showLoading(`Fetching nonce (Attempt ${retryCount + 1}/${MAX_RETRIES})...`);
  try {
    const response = await axios.get(NONCE_URL, { headers, httpsAgent: getRandomProxy() });
    stopLoading();
    logger.success('Fetched nonce');
    return response.data;
  } catch (error) {
    stopLoading();
    if (error.response && error.response.status === 304 && retryCount < MAX_RETRIES - 1) {
      logger.warn(`Received 304 Not Modified for nonce request. Retrying without cache headers...`);
      const newHeaders = { ...headers };
      delete newHeaders['if-none-match'];
      return getNonce(newHeaders, retryCount + 1);
    }
    logger.error(`Failed to fetch nonce: ${error.message}`);
    throw error;
  }
}

async function signMessage(nonce, wallet) {
  const domain = 'enso.brianknows.org';
  const address = wallet.address;
  const statement = 'By signing this message, you confirm you have read and accepted the following Terms and Conditions: https://terms.enso.build/';
  const uri = 'https://enso.brianknows.org';
  const version = '1';
  const issuedAt = new Date().toISOString();

  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${CHAIN_ID}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');

  const signature = await wallet.signMessage(message);
  return { message: { domain, address, statement, uri, version, nonce, issuedAt, chainId: CHAIN_ID }, signature };
}

async function verifySignature(signedMessage, headers) {
  const stopLoading = showLoading('Verifying signature...');
  try {
    const response = await axios.post(VERIFY_URL, signedMessage, { headers, httpsAgent: getRandomProxy() });
    stopLoading();
    if (response.data.ok) {
      logger.success('Signature verified');
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const tokenMatch = setCookie.find(cookie => cookie.includes('brian-token='));
        if (tokenMatch) {
          const token = tokenMatch.split('brian-token=')[1].split(';')[0];
          return token;
        }
      }
      logger.warn('No brian-token found in response');
      return null;
    } else {
      logger.warn('Signature verification failed');
      return null;
    }
  } catch (error) {
    stopLoading();
    logger.error(`Failed to verify signature: ${error.message}`);
    throw error;
  }
}

async function getAccountInfo(headers, brianToken, userId) {
  const stopLoading = showLoading('Fetching account info...');
  try {
    const response = await axios.get(ME_URL, { headers: getHeaders(false, userId, brianToken), httpsAgent: getRandomProxy() });
    stopLoading();
    logger.success('Fetched account info');
    return response.data.account;
  } catch (error) {
    stopLoading();
    logger.error(`Failed to fetch account info: ${error.message}`);
    throw error;
  }
}

async function performChat(query, headers, brianToken, userId, retryCount = 0) {
  const stopLoading = showLoading(`Performing AI chat with query: "${query}" (Attempt ${retryCount + 1}/${CHAT_RETRY_LIMIT})...`);
  try {
    const response = await axios.post(
      SEARCH_URL,
      { query, kbId: KB_ID },
      { headers: getHeaders(true, userId, brianToken), httpsAgent: getRandomProxy() }
    );
    stopLoading();
    logger.success(`Chat completed for query: "${query}"`);
    return true;
  } catch (error) {
    stopLoading();
    if (error.response && error.response.status === 500 && retryCount < CHAT_RETRY_LIMIT - 1) {
      logger.warn(`Received 500 error for query "${query}". Retrying...`);
      await delay(DELAY_MS);
      return performChat(query, headers, brianToken, userId, retryCount + 1);
    }
    logger.error(`Failed to perform chat for query "${query}": ${error.message}`);
    return false;
  }
}

async function createDefiDex(projectSlug, headers, userId, zealyUserId) {
  const stopLoading = showLoading(`Creating DeFiDex project with slug ${projectSlug}...`);
  try {
    const response = await axios.post(
      DEFIDEX_URL,
      {
        userId,
        projectSlug,
        zealyUserId,
        projectType: PROJECT_TYPE,
      },
      { headers, httpsAgent: getRandomProxy() }
    );
    stopLoading();
    if (response.data.success) {
      logger.success(`Created DeFiDex project: ${projectSlug} - ${response.data.message}`);
      return true;
    } else if (response.data.code === 3) {
      logger.warn(`Daily limit reached for project creation: ${response.data.message}`);
      return false;
    } else {
      logger.warn(`Failed to create DeFiDex project: ${projectSlug} - ${response.data.message}`);
      return false;
    }
  } catch (error) {
    stopLoading();
    logger.error(`Error creating DeFiDex project ${projectSlug}: ${error.message}`);
    return false;
  }
}

async function performDailyTasks(account, accountIndex) {
  const { privateKey, userId, zealyUserId } = account;
  const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);

  logger.info(`Processing account ${accountIndex} of ${accounts.length}\n`);
  logger.step(`Starting daily tasks for Account ${accountIndex} (User ID: ${userId})`);
  logger.step(`Zealy User ID: ${zealyUserId}\n`);

  logger.step('Starting DeFiDex creation...');
  let dexSuccessCount = 0;
  const dexHeaders = getHeaders(false, userId);

  for (let i = 1; i <= DEFIDEX_DAILY_LIMIT; i++) {
    const projectSlug = generateProjectSlug();
    logger.step(`Creating DeFiDex ${i}/${DEFIDEX_DAILY_LIMIT} with slug: ${projectSlug}`);
    const success = await createDefiDex(projectSlug, dexHeaders, userId, zealyUserId);
    if (success) {
      dexSuccessCount++;
    } else if (!success && i === 1) {
      logger.warn('Daily limit already reached. Skipping DeFiDex creation.');
      break;
    }
    await delay(DELAY_MS);
  }
  logger.success(`Completed DeFiDex creation: ${dexSuccessCount}/${DEFIDEX_DAILY_LIMIT} successful\n`);

  logger.step('Starting AI chat authentication...');
  const chatHeaders = getHeaders(true, userId);
  try {
    const nonce = await getNonce(getHeaders(false, userId, null));
    const signedMessage = await signMessage(nonce, wallet);
    const brianToken = await verifySignature(signedMessage, chatHeaders);
    if (!brianToken) {
      logger.error('Authentication failed due to missing brian-token. Skipping AI chat.');
      return;
    }
    await getAccountInfo(chatHeaders, brianToken, userId);

    logger.step('Starting AI chat queries...');
    let chatSuccessCount = 0;
    const usedQueries = new Set();
    for (let i = 1; i <= CHAT_DAILY_LIMIT; i++) {
      let query;
      do {
        query = RANDOM_QUERIES[Math.floor(Math.random() * RANDOM_QUERIES.length)];
      } while (usedQueries.has(query));
      usedQueries.add(query);

      logger.step(`Performing chat ${i}/${CHAT_DAILY_LIMIT} with query: "${query}"`);
      const success = await performChat(query, chatHeaders, brianToken, userId);
      if (success) chatSuccessCount++;
      await delay(DELAY_MS);
    }
    logger.success(`Completed AI chat: ${chatSuccessCount}/${CHAT_DAILY_LIMIT} successful\n`);
  } catch (error) {
    logger.error(`AI chat process failed: ${error.message}`);
  }
}

const startCountdown = () => {
  const nextRun = Date.now() + DAILY_INTERVAL_MS;
  const interval = setInterval(() => {
    const now = Date.now();
    const timeLeft = nextRun - now;
    if (timeLeft <= 0) {
      clearInterval(interval);
      logger.banner();
      accounts.forEach((account, index) => {
        logger.info(`Validated account ${index + 1}:`);
        logger.info(`USER_ID_${index + 1}: ${account.userId}`);
        logger.info(`ZEALY_USER_ID_${index + 1}: ${account.zealyUserId}\n`);
      });
      logger.info(`Loaded ${proxies.length} proxies from proxies.txt\n`);
      main();
    } else {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      process.stdout.write(
        `${colors.cyan}[⟳] Next run in ${hours}h ${minutes}m ${seconds}s\r${colors.reset}`
      );
    }
  }, 1000);
};

async function main() {
  for (let i = 0; i < accounts.length; i++) {
    await performDailyTasks(accounts[i], i + 1);
    await delay(DELAY_MS * 2);
  }
  startCountdown();
}

main().catch((error) => {
  logger.error(`Bot encountered an error: ${error.message}`);
  process.exit(1);
});
