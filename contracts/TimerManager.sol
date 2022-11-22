pragma ever-solidity >= 0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
// pragma copyleft 0, 0x128a82862f76bad89b700e7a82cd0b29eb0be9d46c6842f3e2be1898047dec97;

contract TimerManager {

  uint32 static _nonce;
  
  address static _owner;

  address _dest;     // Destination address where the message will be sent
  TvmCell _payload;  // Message payload

  uint128 _reward;   // Amount of tokens for server tik

  uint64 _delay;   // Delay in seconds between activations, 0 if onetime event
  uint64 _next;    // next activation time
  uint64 _last;    // last activation time
  
  bool   _active;    // active
  
  uint16 constant WRONG_OWNER          = 1010;
  uint16 constant WRONG_PARAMS         = 1020;
  uint16 constant WRONG_TIME           = 1030;

  event EventUpdate(uint128 reward, uint128 balance, uint64 next, uint64 last, bool active); 

  modifier checkOwnerAndAccept {
    require((_owner != address(0) && msg.sender == _owner) || msg.pubkey() == tvm.pubkey(), WRONG_OWNER);
    tvm.accept();
    _;
  }

  constructor() public checkOwnerAndAccept {

  }

  function getDetails() public view returns (uint128 reward, uint128 balance, uint64 next, uint64 last, bool active){
    return ( _reward, address(this).balance, _next, _last, _active );
  }

  function setEvent(
    address dest,
    TvmCell payload,
    uint64 delay,
    uint64 next,
    uint128 reward,
    bool active
  ) public checkOwnerAndAccept {
    require(delay != 0 || next != 0, WRONG_PARAMS);
    if (delay != 0 && next == 0) {
        _next = uint64(now) + delay;
    } else {
        _next = next;
    }
    _dest = dest;
    _payload = payload;
    _delay = delay;
    _reward = reward;
    _active = active;
    
    emit EventUpdate( _reward, address(this).balance, _next, _last, _active );
  }

  function callTimer(address miner) public {
    uint64 _now = uint64(now);
    require(_now >= _next, WRONG_TIME);
    require(address(this).balance > _reward, WRONG_PARAMS);
    tvm.accept();
    _last = _next;
    if (_delay != 0) {
      while (_next < _now) {
        _next += _delay;
      }
    } else {
      _active = false;
    }
    miner.transfer({value: _reward, flag: 3, bounce: false});
    _dest.transfer({value: 0, flag: 3, bounce: false, body: _payload});
    emit EventUpdate( _reward, address(this).balance, _next, _last, _active );
  }

  function destroy(address dest) public checkOwnerAndAccept {
    selfdestruct(dest);
  }
  
  receive() external view {
    emit EventUpdate( _reward, address(this).balance, _next, _last, _active );
  }
}