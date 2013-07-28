util = require('espr-util');

/**
  Different than events, a router calls first most specifically matched
  subscriber.

  @class Router
  @constructor
**/
function Router() {
  var inst = this
  this.handle = function(){
    inst.providedThis = this
    Router.prototype.handle.apply(inst,arguments)
  }
};

/**
  Adds listener to be called when the pattern matches.

  @param {String} pattern     specified like /path/with/:param
  @param {Function} listener  the subscriber
  @return `this`
**/
Router.prototype.on = function(pattern, listener) {
  if (!this._routeTree) { this._routeTree = {}; }

  // clean pattern and get parts
  if (!listener && (typeof pattern == 'function')) { listener = pattern; pattern = "/"; }
  pattern = "/"+pattern.replace(/\/+$/,"").replace(/^\/+/,""); // strip trailing slash but ensure leading slash
  var parts = pattern.split("/").slice(1); // split, slicing the first since we ensured a leading slash

  // follows a path down the pattern tree, creating nodes which do not yet exist
  var node = this._routeTree;
  for (var i = 0; i < parts.length; ++i) {
    var part = parts[i];
    if (part.length <= 0) { // no pattern or blank pattern
      continue;
    } else if (part.charAt(0)==':') { // param matcher
      var paramName = part.substr(1);
      if (/^[a-zA-Z0-9_]+$/.test(paramName)) {
        if (!node[":"]) { node[":"] = {}; }
        if (!node[":"][paramName]) { node[":"][paramName] = {}; }
        node = node[":"][paramName];
        continue;
      } else {
        throw new Error("invalid param matcher "+part);
      }
    } else { // normal pattern match
      if (/^[a-zA-Z0-9_]+$/.test(part)) {
        if (!node[part]) { node[part] = {}; }
        node = node[part];
        continue;
      } else {
        throw new Error("invalid pattern part "+part);
      }
    }
  }

  // place our listener on the / node of the deepest matched pattern
  if (!node["/"]) { node["/"] = []; }
  node["/"].push(listener);
  return this;
};

/**
  Establishes a method called before any listeners. Any paths
  beginning with the requested path will be matched.

  @return `this`
**/
Router.prototype.before = function(pattern, listener) {
  if (!this._beforeTree) { this._beforeTree = {}; }

  if ('function'===typeof pattern) {
    listener = pattern
    pattern = "/"
  }
  pattern = "/"+pattern.replace(/\/+$/,"").replace(/^\/+/,"")
  var parts = pattern.split("/").slice(1)

  if (parts[0]==='') {
    if (!this._beforeTree['/']) this._beforeTree['/']=[]
    this._beforeTree['/'].push(listener)
  } else {
    var node = this._beforeTree
    // traversed down beforeTree for each parts,
    // creating nodes which do not exist
    for (var i = 0; i < parts.length; ++i) {
      if (!node[parts[i]]) {
        node[parts[i]] = {'/':[]}
      }
      node = node[parts[i]]
    }
    node['/'].push(listener)
  }
  return this
}

/**
  Handles an incoming event.

  @param {String} route  parameter to test patterns against
  @param ...             arguments passed to called listener.
  @return `this`
**/
Router.prototype.handle = function(route) {
  if ('string'!==typeof route) {
    throw new Error("dsprsn.Router#handle expected string for first parameter but got "+route)
  }

  // save any args beyond the first one
  var args = Array.prototype.slice.call(arguments,1);

  // param variables matched
  var params = {};

  // injected instance
  var inst = this.providedThis;

  // clean route and get parts
  route = "/"+route.replace(/\/+$/,"").replace(/^\/+/,""); // trip trailing slash but ensure leading slash
  var parts = route.split("/").slice(1); // split, slicing the first off since we ensured a leading slash

  // execute any before filters
  var beforePromise = util.Deferred.fulfilled()
  if (this._beforeTree) {
    var bnode = this._beforeTree
    if (bnode['/']&&bnode['/'].length>0) {
      bnode['/'].forEach(function(listener){
        var result = listener.apply(inst, args)
        // if promise returned, push onto deferred chain
        if (result&&'function'===typeof result.then) {
          beforePromise = result.then(beforePromise)
        }
      })
    }
    for (var bi = 0; bi < parts.length; ++bi) {
      if (bnode[parts[bi]]) {
        bnode = bnode[parts[bi]]
        if (bnode&&bnode['/'].length>0) {
          bnode['/'].forEach(function(listener){
            var result = listener.apply(inst, args)
            // if promise returned, push onto deferred chain
            if (result&&'function'===typeof result.then) {
              beforePromise = result.then(beforePromise)
            }
          })
        }
      } else {
        bnode = null
        break
      }
    }
  }

  // follows a path down the route tree, matching the first applicable path
  var node = this._routeTree;
  var i = 0;
  for (; i < parts.length; ++i) {
    var part = parts[i];
    if (part.length <= 0) { // no route or blank route
      continue;
    } else if (node[part]) { // normal route match
      node = node[part];
      continue;
    } else if (node[":"]) { // if there are param matchers
      var firstNode = null;
      for (var key in node[":"]) {
        if ({}.hasOwnProperty.call(node[":"],key)){
          if (firstNode==null) { firstNode = node[":"][key]; }
          params[key] = part; // attach value to param hash
        }
      }
      if (firstNode) {
        node = firstNode;
        continue;
      } else {
        throw new Error("param matcher fake out?!")
      }
    } else {
      break;
    }
  }

  // todo: probably shouldn't indiscriminantly try to attach properties to the first param
  if (!args[0]) { args[0] = {}; }
  args[0].route = route;
  args[0].params = params;
  util.merge(args[0],params)

  // call any listeners on "/", if there is no slash then route error?
  var resultPromise;
  if (node["/"]) {
    var resultPromise = beforePromise.then(function(){
      var result;
      node["/"].forEach(function(listener){
        // call handle if the listener has it (such as a Router instance)
        if (listener.handle) {
          args.unshift(parts.slice(i).join('/'));
          result = listener.handle.apply(inst,args);
        } else {
          result = listener.apply(inst, args);
        }
      });
      // return result;
    })
  } else {
    console.info(this)
    throw new Error("could not route: "+route);
  }

  // save successful route match
  this._currentRoute = route;

  return resultPromise;
};

module.exports = Router;