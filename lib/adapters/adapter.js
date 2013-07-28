var util = require('espr-util')

/**
  @class AdapterClient
  @constructor
**/
function AdapterClient(options) {
  if (!options.server) {
    throw new Error('AdapterClient(options) requires options.server')
  }
  this._conn = options.server.connect(this)
}

/**
  @class AdapterServer
  @constructor
**/
function AdapterServer() {
}

/**
  @class ConnectedClient
  @constructor
**/
function ConnectedClient(options) {
  if (!options.client) {
    throw new Error('ConnectedClient(options) requires options.client')
  }
  this._client = options.client
}

util.extends(AdapterClient, util.Events)
util.extends(AdapterServer, util.Events)
util.extends(ConnectedClient, util.Events)

AdapterClient.prototype.send = function() {
  var args = Array.prototype.slice.call(arguments, 0)
  args.unshift('')
  setTimeout(function(){
    this._conn.emit.apply(this._conn, args)
  }.bind(this), 0)
}

AdapterServer.prototype.connect = function(client){
  var conn = new ConnectedClient({client: client})
  setTimeout(function(){
    this.emit('new',conn)
  }.bind(this), 0)
  return conn
}


ConnectedClient.prototype.send = function() {
  var args = Array.prototype.slice.call(arguments, 0)
  args.unshift('')
  setTimeout(function(){
    this._client.emit.apply(this._client, args)
  }.bind(this), 0)
}


/**
  Adapters wrap transports for communication between clients and servers.

  @class Adapter
  @static
**/
var Adapter = module.exports = {
  Client: AdapterClient,
  Server: AdapterServer
}