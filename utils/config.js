const fs = require('fs');

const CONFIG_PATH = './config.json';


const saveConf = (data) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, false, ' '), 'utf8');
};

const updConf = (data) => {
  let _data = readConf();
  _data = Object.assign(_data, data);
  saveConf(_data);
};

const readConf = () => {
  let data = {}
  try {
    let rawdata = fs.readFileSync(CONFIG_PATH);
    data = JSON.parse(rawdata);
  } catch (err) {
    console.log(err)
  }
  return data
};


module.exports = {
  saveConf,
  readConf,
  updConf
};
