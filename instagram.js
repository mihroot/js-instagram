/**
 * @preserve Instagram library by @blixt
 */

function toint(i) {
	i = parseInt(i);
	if(isNaN(i))
		i = 0;
	return i;
}

function executeFunctionByName(functionName, thisArg, args ) {
	var context = window;
	var namespaces = functionName.split(".");
	var func = namespaces.pop();
	for(var i = 0; i < namespaces.length; i++) {
		context = context[namespaces[i]];
	}
	return context[func].apply(thisArg, args);
}

/**
 * InstagramEvents
 * Helper functions to manage events
 */
InstagramEvents = {
	subscribers: {},
	bind: function(a, f, n) {
		if(typeof(InstagramEvents.subscribers[a]) == 'undefined') {
			InstagramEvents.subscribers[a] = [];
		}
		
		if(typeof(n) == 'undefined') {
			n = null;
		}
		
		InstagramEvents.subscribers[a].push([f, n]);
	},
	unbind: function(a, n) {
		if(typeof(InstagramEvents.subscribers[a]) == 'undefined') {
			return false;
		}
		
		if(typeof(n) == 'undefined') {
			n = null;
		}
						
		var l = InstagramEvents.subscribers[a].length;
		while(l--) {
			if(InstagramEvents.subscribers[a][l][1] === n) {
				InstagramEvents.subscribers[a].splice(l, 1);
			}
		}
		
		if(InstagramEvents.subscribers[a].length <= 0)
			delete InstagramEvents.subscribers[a];
	},
	trigger: function(a, p) {
		
		if(typeof(InstagramEvents.subscribers[a]) == 'undefined') {
			return false;
		}
		
		if(typeof(p) == 'undefined') {
			p = [];
		} else {
			p = [p];
		}
		
		for(var k in InstagramEvents.subscribers[a]) {
			if(typeof(InstagramEvents.subscribers[a][k][0]) == 'string') {
				executeFunctionByName(InstagramEvents.subscribers[a][k][0], window, p);
			} else {
				InstagramEvents.subscribers[a][k][0].apply(window, p);
			}
		}
	}
}


/**
 * Creates a new Instagram API client.
 * @param {string} clientId The client_id parameter to send to Instagram's API.
 * @param {Instagram.OAuthDisplay=} Determines how the auth dialog is rendered. Defaults to
 *     Instagram.OAuthDisplay.PAGE.
 * @constructor
 */
function Instagram(clientId, display, redirectURI) {
  var o = this;
  
  // Get parameters in the hash (#) part of the address bar.
  var params = Instagram.deQueryString_(location.hash.substr(1));

  /**
   * The client ID of this API client.
   * @type {string}
   */
  this.clientId = clientId;

  /**
   * The access token to do API calls on the user's behalf. Will only be
   * available if the user is authenticated.
   * @type {?string}
   */
  this.accessToken = params['access_token'] || null;
  
  
  this.redirectURI = redirectURI || location.href;
  
  /**
   * How auth dialog is rendered
   * @type {Instagram.OAuthDisplay=}
   */
  this.display = display || Instagram.OAuthDisplay.PAGE;
  
  if(this.accessToken && this.display == Instagram.OAuthDisplay.POPUP) {
	  //We got our access token, so return access token to parent window and close popup
	  if(window.opener) {
		  if(window.opener.InstagramEvents) {
			  window.opener.InstagramEvents.trigger('Insta.tokenRecevied_'+this.clientId, this.accessToken);
		  }
		  window.close();
		  return;
	  }
  }
  
  /**
   * Temporary storage of next request GET parameters.
   * @type {object}
   */
  this.requestParams = {};
  
  /**
   * Images only filter
   * @type {bool}
   */
  this.imagesOnly = false;

  //Subscribe on events
  InstagramEvents.bind('Insta.tokenRecevied_'+o.clientId, function(access_token) {
	  o.accessToken = access_token;
	  InstagramEvents.trigger('Insta.onLogin_'+o.clientId);
  });
}

/**
 * The URL to direct the browser to when authenticating.
 * @const
 */
Instagram.AUTH_URL = 'https://api.instagram.com/oauth/authorize/';

/**
 * The base URL for all API calls.
 * @const
 */
Instagram.BASE_URL = 'https://api.instagram.com/v1';

/**
 * A bitmask of OAuth dialog rendering types.
 * @enum
 */
Instagram.OAuthDisplay = {
  PAGE: 1,
  POPUP: 2
};

/**
 * A bitmask of OAuth scopes.
 * @enum
 */
Instagram.Scope = {
  ALL: 2047, /* 1,2,4 ... 1024*/
  BASIC: 1,
  LIKES: 2,
  COMMENTS: 4,
  RELATIONSHIPS: 8
};

/**
 * Translates an OAuth scope bit to a value.
 * @enum {string}
 * @private
 */
Instagram._translateScope = {
  1: 'basic',
  2: 'likes',
  4: 'comments',
  8: 'relationships'
};

/**
 * Turns a query string (after ? or #) into a key/value object.
 * @param {string} queryString The query string.
 * @return {Object.<string, (string|boolean)>} A map of values in the query
 *     string.
 * @private
 */
Instagram.deQueryString_ = function (queryString) {
  var params = {};

  var parts = queryString.split('&');
  
  for(var i in parts) {
	var part = parts[i];
	var keyValue = part.split('=');
    var key = unescape(keyValue[0]);
    // If there is no equals sign, the value will be boolean true instead.
    if (keyValue.length == 1) {
      params[key] = true;
    } else {
      params[key] = unescape(keyValue[1].replace(/\+/g, '%20'));
    }
  }

  return params;
};

/**
 * A counter that ensures that even if two JSONP requests are made in the same
 * millisecond, they will have unique names.
 * @type {number}
 */
Instagram.jsonpCounter_ = 1;

/**
 * Performs a JSONP request for the specified URL which will call the given
 * callback. Be careful with JSONP requests since they will execute arbitrary
 * JavaScript code in your browser.
 * @param {string} url The URL to request.
 * @param {function(Object)} callback The callback that will be called in the
 *     resulting JSONP code.
 */
Instagram.jsonp_ = function (url, callback) {
  // Set up callback.
  var callbackName = '_instagram_jsonp_cb_' + (+new Date()) + '_' +
    (Instagram.jsonpCounter_++);
  window[callbackName] = callback;
  url += (url.indexOf('?') == -1 ? '?' : '&') + 'callback=' + callbackName;

  // Get a reference to the <head> element.
  var head = document.head || document.getElementsByTagName('head')[0] ||
             document.documentElement;

  // Set up request element.
  var script = document.createElement('script');
  script.async = 'async';
  script.src = url;
  script.onload = script.onreadystatechange = function () {
    if (!script.readyState || /loaded|complete/.test(script.readyState)) {
      // Clean up.
      script.onload = script.onreadystatechange = null;
      if (head && script.parentNode) head.removeChild(script);
      script = undefined;

	  //ie8 support
      window[callbackName] = undefined;
      try{
        delete window[callbackName];
      }catch(e){}
	}
  };

  // Start request.
  head.insertBefore(script, head.firstChild);
};

/**
 * Turns a key/value object into a query string.
 * @param {Object} params A map of values to turn into a query string.
 * @return {string} The query string.
 * @private
 */
Instagram.queryString_ = function (params) {
  var parts = [];
  for (var key in params) {
    var value = params[key];
    if (!value) continue;
    // If the value is not a string, the equals sign and value will not be
    // included.
    if (typeof value == 'string') {
      parts.push(escape(key) + '=' + escape(value).replace(/%20/g, '+'));
    } else {
      parts.push(escape(key));
    }
  }
  return parts.join('&');
}

/**
 * Opens Instagram auth popup
 * @param {string} URL to show in popup window.
 * @return {string} The query string.
 * @private
 */
Instagram.popup_ = function (url) {

  var popupName = '_blank';
  var width = 554;
  var height = 349;
  
  var w = window, de = document.documentElement;
  var dwidth = Math.max(toint(w.innerWidth), toint(de.clientWidth));
  var dheight = Math.max(toint(w.innerHeight), toint(de.clientHeight));
		  
  var left = (dwidth - width) / 2;
  var top = (dheight - height) / 2;
  var popupParams = 'location=1, scrollbars=0, resizable=1, menubar=0, left=' + left + ', top=' + top + ', width=' + width + ', height=' + height + ', toolbar=0, status=0';
  var aw = window.open(url, popupName, popupParams);
  aw.blur();
  aw.focus();
  
  return false;
}

/**
 * Builds an API endpoint URL.
 * @param {string} path The path to the API call to make.
 * @param {Object=} opt_params An (optional) map of values to add to the URL
 *     query string.
 * @return {string} The complete URL to the desired call.
 * @private
 */
Instagram.prototype.getUrl_ = function (path, opt_params) {
  if (!path[0] == '/') path = '/' + path;

  // Always include access_token if available; otherwise, client_id.
  if (!opt_params) opt_params = this.requestParams;
  if (this.accessToken) {
    opt_params['access_token'] = this.accessToken;
  } else {
    opt_params['client_id'] = this.clientId;
  }

  //Reset requestParams
  this.requestParams = {};

  return Instagram.BASE_URL + path + '?' + Instagram.queryString_(opt_params);
};

/**
 * Handle the code generic to all media requests. Basically, do the request,
 * get all media items of type "image" and preload if requested; then, call the
 * callback function with the result set.
 * @param {string} path The path to request.
 * @param {function(Array.<InstagramImage>)} callback The callback to call when
 *     done.
 * @param {boolean} preload Whether to preload the images before calling the
 *     callback.
 */
Instagram.prototype.mediaRequest_ = function (url, callback, preload) {
  var o = this;
  Instagram.jsonp_(this.getUrl_(url), function (response) {
    var images = [];

    var data = response.data; var len;
    for (var i = 0, len = data.length; i < len; i++) {
      var media = data[i];
      if (!o.imagesOnly || media.type == 'image') {
        images.push(InstagramImage.get(media));
      }
    }

    if (preload) {
      InstagramImage.preload(images, callback);
    } else {
      callback(images);
    }
  });
};


/**
 * Stores params that will be used in next request.
 * @param {Object=} params An map of values to add to the URL
 *     query string.
 * @return {bool}
 * @public
 */
Instagram.prototype.setRequestParams = function (params) {
	if(typeof(params) != 'object')
		return false;
	
	this.requestParams = params;
	
	return true;
}

/**
 * Authenticates the user with the Instagram API. This will cause a redirect
 * unless the user has already been authenticated.
 * @param {Instagram.Scope=} opt_scope Scopes to authenticate with. Defaults to
 *     Instagram.Scope.BASIC.
 * @param {function()} callback A callback for handling
 *     successful login event.
 * @return {boolean} True if the user is already authenticated; otherwise,
 *     false.
 */
Instagram.prototype.authenticate = function (opt_scope) {   
  // TODO(blixt):
  // This function should check/set cookies so that the browser doesn't always
  // have to be sent to instagram.com.
  if (this.accessToken) {
    InstagramEvents.trigger('Insta.onLogin_'+this.clientId);
    return true;
  }

  if (!opt_scope) opt_scope = Instagram.Scope.BASIC;

  var scope = [];
  for (var bit in Instagram._translateScope) {
    if (opt_scope & parseInt(bit)) {
      scope.push(Instagram._translateScope[bit]);
    }
  }

  if (!scope.length) {
    throw new Error('Invalid scope ' + opt_scope);
  }

  var authURL = Instagram.AUTH_URL + '?' + Instagram.queryString_({
    client_id: this.clientId,
    redirect_uri: this.redirectURI,
    response_type: 'token',
    scope: scope.join(' ')
  });
  
  if(this.display == Instagram.OAuthDisplay.PAGE) {
    location.href = authURL;
  } else {
    Instagram.popup_(authURL, []);
  }  

  return false;
};

Instagram.prototype.onLogin = function (callback) {   
  if(callback != undefined) {
  	InstagramEvents.bind('Insta.onLogin_'+this.clientId, callback);
	if (this.accessToken && this.display == Instagram.OAuthDisplay.POPUP) {
    	InstagramEvents.trigger('Insta.onLogin_'+this.clientId);
	}
  }
  return false;
};

/**
 * Gets the images from user feed.
 * @param {string} user The user to fetch the feed for. Pass in "self" to get
 *     the feed of the currently authenticated user.
 * @param {function(Array.<InstagramImage>)} callback A callback for handling
 *     the fetched images.
 * @param {boolean=} opt_preload Whether to first preload the images before
 *     calling the callback. This means the callback will be called later. If
 *     you want to use the image data before the images have been loaded, don't
 *     pass in this flag and instead call the {@link InstagramImage#preload}
 *     function on the collection to preload the images separately.
 */
Instagram.prototype.getFeed = function (user, callback, opt_preload) {
  this.mediaRequest_('/users/' + user + '/feed',
      callback,
      !!opt_preload);
};


/**
 * Gets the images that the specified user has recently posted.
 * @param {string} user The user to fetch the recent media for. Pass in "self" to get
 *     the data of the currently authenticated user.
 * @param {function(Array.<InstagramImage>)} callback A callback for handling
 *     the fetched images.
 * @param {boolean=} opt_preload Whether to first preload the images before
 *     calling the callback. This means the callback will be called later. If
 *     you want to use the image data before the images have been loaded, don't
 *     pass in this flag and instead call the {@link InstagramImage#preload}
 *     function on the collection to preload the images separately.
 */
Instagram.prototype.getRecent = function (user, callback, opt_preload) {
  this.mediaRequest_('/users/' + user + '/media/recent',
      callback,
      !!opt_preload);
};

/**
 * Gets the images that the specified user has liked recently.
 * @param {string} user The user to fetch likes for. Pass in "self" to get the
 *     likes of the currently authenticated user.
 * @param {function(Array.<InstagramImage>)} callback A callback for handling
 *     the fetched images.
 * @param {boolean=} opt_preload Whether to first preload the images before
 *     calling the callback. This means the callback will be called later. If
 *     you want to use the image data before the images have been loaded, don't
 *     pass in this flag and instead call the {@link InstagramImage#preload}
 *     function on the collection to preload the images separately.
 */
Instagram.prototype.getLikes = function (user, callback, opt_preload) {
  this.mediaRequest_('/users/' + user + '/media/liked',
      callback,
      !!opt_preload);
};

/**
 * Gets the images that are the most popular right now.
 * @param {function(Array.<InstagramImage>)} callback A callback for handling
 *     the fetched images.
 * @param {boolean=} opt_preload Whether to first preload the images before
 *     calling the callback. This means the callback will be called later. If
 *     you want to use the image data before the images have been loaded, don't
 *     pass in this flag and instead call the {@link InstagramImage#preload}
 *     function on the collection to preload the images separately.
 */
Instagram.prototype.getTopImages = function (callback, opt_preload) {
  this.mediaRequest_('/media/popular',
      callback,
      !!opt_preload);
};

/**
 * Represents a single Instagram image.
 *
 * This constructor shouldn't be used directly. Instead, use the methods on the
 * {@link Instagram} class.
 *
 * @param {Object} data The data for this image as returned by Instagram.
 * @constructor
 * @private
 */
function InstagramImage(data) {
  this.id = data.id;
  this.imageUrl = data.images.standard_resolution.url;
  this.imageThumbnailUrl = data.images.thumbnail.url;
}

/**
 * A cache of InstagramImage instances.
 * @type {Object.<string, InstagramImage>}
 * @private
 */
InstagramImage.cache_ = {};

/**
 * A map keeping track of what URLs have been preloaded.
 * @type {Object.<string, boolean>}
 * @private
 */
InstagramImage.preloaded_ = {};

/**
 * An event handler responsible for handling the error/load events of the Image
 * instances created by {@link InstagramImage#preload}.
 * @param {Event} evt The error/load event.
 * @private
 */
InstagramImage.eventHandler_ = function (evt) {
  // Lose all references.
  this.removeEventListener('error', InstagramImage.eventHandler_);
  this.removeEventListener('load', InstagramImage.eventHandler_);

  // Mark the image as successfully preloaded.
  if (evt.type == 'load') {
    InstagramImage.preloaded_[this.src] = true;
  } else {
    // TODO(blixt): Should report back to calling code when failing.
    if (console) console.error('Failed to preload ' + this.src);
  }
};

/**
 * Gets an InstagramImage object for the specified data, either from cache or
 * by creating a new instance. This will also update old instances with new
 * data.
 *
 * This function shouldn't be used directly. Instead, use the methods on the
 * {@link Instagram} class.
 *
 * @param {Object} data The data for the image as returned by Instagram.
 * @return {InstagramImage} The InstagramImage instance representing the given
 *     data.
 * @protected
 */
InstagramImage.get = function (data) {
  var image = InstagramImage.cache_[data.id];
  if (image) {
    image.update(data);
  } else {
    image = new InstagramImage(data);
  }
  return image;
};

/**
 * Ensure that the actual images of the provided list of InstagramImage objects
 * have been downloaded, then call the provided callback.
 *
 * If any images have not been (or are in the process of being) preloaded, this
 * will cause the images to begin preload.
 *
 * @param {Array.<InstagramImage>} images The images to preload.
 * @param {function(Array.<InstagramImage>)} callback The callback to call when
 *     all the images have been preloaded. The array will be the same as the
 *     one passed in, so avoid modifying it.
 */
InstagramImage.preload = function (images, callback) {
  var imagesLeft = images.length;

  // This is a callback that will count down the number of images left to
  // preload and then call the callback when all of them have been loaded.
  var imageLoaded = function (evt) {
    // Remove event handlers.
    if (evt) {
      this.removeEventListener('error', imageLoaded);
      this.removeEventListener('load', imageLoaded);
    }

    imagesLeft--;
    if (!imagesLeft) {
      callback(images);
    }
  };

  for (var i = 0, len = images.length; i < len; i++) {
    var url = images[i].imageUrl;

    // Only allow an image URL to be preloaded once.
    if (url in InstagramImage.preloaded_) {
      imageLoaded();
      continue;
    }

    var temp = new Image();
    temp.src = url;
    temp.addEventListener('error', InstagramImage.eventHandler_);
    temp.addEventListener('error', imageLoaded);
    temp.addEventListener('load', InstagramImage.eventHandler_);
    temp.addEventListener('load', imageLoaded);
    InstagramImage.preloaded_[url] = false;
  }
};

/**
 * Updates this instance with new data.
 * @param {Object} data The data (from the API) to update the image with.
 */
InstagramImage.prototype.update = function (data) {
  if (data.id != this.id) {
    throw new Error('Tried to update InstagramImage with data for another ' +
                    'image');
  }

  // TODO(blixt): This has not been implemented yet.
};