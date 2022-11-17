const { TonClient, signerKeys, abiContract, MessageBodyType, ResponseType } = require("@eversdk/core");
const { libNode } = require("@eversdk/lib-node");
const { Account } = require("@eversdk/appkit");

const allAccounts = require("../utils/allAccounts");
const { Subscriber, Events } = require("../utils/subscriber")

let abiManager = require("../build/TimerManager.abi.json");
let Config = require("../config.json");

TonClient.useBinaryLibrary(libNode);

let client, signer;
let handleAll;
let timerManagers = []
let codeHash = Config.codeHash;
let endpoint = Config.endpoint;
let profit = Config.profit;

(async () => {
    try {
        client = new TonClient({ network: { endpoints: [endpoint] } });
        await main(client);
    } catch (err) {
        console.error(err);
    } finally {
        //client.close();
    }
})();

function countractTimer() {
  setTimeout(async () => {
    let d = Math.floor(Date.now() / 1000) - 1;
    console.log("now:", d, Date.now());
    
    let _accounts = timerManagers.filter( el => el.active && 1*el.next <= d && 1*el.balance > 1*el.reward );
    _accounts = _accounts.map(el => { return { ...el, rnd: Math.random() } }).sort((a, b) => { return a.rnd - b.rnd });
    
    for (let i=0; i<_accounts.length; i++) {
      
      timerManagers.find( el => el.address == _accounts[i].address ).active = false;
      let account = new Account({abi: abiManager}, { address: _accounts[i].address, signer, client });
      
      try {
        
        await account.run("callTimer", { miner: profit });
        
      } catch (err) {
        console.error(err)
        // if (err.code == '414' && err.data.exit_code == '1020') { //balance < _reward
        // } else if (err.code == '414' && err.data.exit_code == '-14') { //out of gas
        // }
      }  

    }

    countractTimer()
  }, 1000)
}

async function main() {
  try {
    
    let accounts = await allAccounts(client, { codeHash, itemsPerPage: 20, pagesLimit: 10 })
    timerManagers = await Promise.all(accounts.map(async (acc) => {
      let res = await runLocal(abiManager, acc.id, 'getDetails', {}, false, acc.boc)
      return { address: acc.id, ...res }
    }))
    console.error('timerManagers', timerManagers.length)

    await subscribeAllManagers()
    await subscribeNewManagers()
    
    
    const keys = await client.crypto.generate_random_sign_keys();
    signer = signerKeys(keys);

    // const serverTime = (await client.net.query({"operationName":null,"variables":{},"query":"{\n  info {\n    time\n  }\n}\n"})).result;
    // console.error('serverTime', serverTime, Date.now())

    countractTimer();
    
  } catch (err) {
    console.error(err)
  }  
}

/////////////// SERVICE

async function subscribeNewManagers() {
  try {

    const codeHashQuery = {
        collection: "messages",
        filter: {
            code_hash: {
              eq: codeHash
            }
        },
        result: "id src dst boc",
    }

    const subscriber = new Subscriber(client, codeHashQuery)

    subscriber.on(Events.DATA, async (data) => {
        const decoded = await TonClient.default.abi.decode_message({
            abi: abiContract(abiManager),
            message: data.boc,
        });
        if (decoded.body_type == MessageBodyType.Input && decoded.name == 'constructor') {
          let res = await runLocal(abiManager, data.dst, 'getDetails', {}, true)
          timerManagers.push({ address: data.dst, ...res })
          subscribeAllManagers();
          console.error('timerManagers', timerManagers.length)
        }
    })

    subscriber.on(Events.ERROR, async (params) => {
        console.error(params)
        // subscriber.removeAllListeners()
        // await subscriber.unsubscribe()
        // client.close()
    })

    await subscriber.subscribe()

  } catch (err) {
    console.error(err)
  }  
}

async function subscribeAllManagers() {
  try {

    const AddressQuery = {
        collection: "messages",
        filter: {
            src: {
              in: timerManagers.map(el => el.address)
            },
            dst: {
              eq: ''
            }
        },
        result: "id src dst boc",
    }
    if (handleAll) {
      handleAll.unsubscribe();     
    }
    const subscriber = new Subscriber(client, AddressQuery)
    handleAll = subscriber;
  
    subscriber.on(Events.DATA, async (data) => {
        const decoded = await TonClient.default.abi.decode_message({
            abi: abiContract(abiManager),
            message: data.boc,
        });
        console.error('account Event', decoded.name, decoded.value)
        if (decoded.body_type == MessageBodyType.Event && decoded.name == 'EventUpdate') {
          // let res = await runLocal(abiManager, data.src, 'getDetails', {}, true)
          let ind = timerManagers.findIndex(el => el.address == data.src)
          timerManagers[ind] = { address: data.src, ...decoded.value }
        }
    })

    subscriber.on(Events.ERROR, async (params) => {
        console.error(params)
        // subscriber.removeAllListeners()
        // await subscriber.unsubscribe()
        // client.close()
    })

    await subscriber.subscribe()

  } catch (err) {
    console.error(err)
  }  
}

const runLocal = async (abi, address, functionName, input = {}, log = false, boc = null)  => {
  try {
    const [account, message] = await Promise.all([
        boc || client.net.query_collection({
            collection: "accounts",
            filter: { id: { eq: address } },
            result: "boc",
        })
            .then(({ result }) => result[0].boc)
            .catch(() => {
                return undefined;
            }),
        client.abi.encode_message({
            abi: {
                type: 'Contract',
                value: (abi)
            },
            address,
            call_set: {
                function_name: functionName,
                input: input,
            },
            signer: { type: "None" },
        }).then(({ message }) => message),
    ]);
    if (!account) return undefined;
    let response = await client.tvm.run_tvm({
        message: message,
        account: account,
        abi: {
            type: 'Contract',
            value: (abi)
        },
    });
    if (log) console.log("output:", response.decoded.output);

    return response.decoded.output;
  } catch (error) {
      console.error(error, functionName, input);
  }
}





