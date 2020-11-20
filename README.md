# xIFr

xIFr is a browser extension for viewing EXIF, IPTC and XMP metadata in jpg image files. Launch it from the desktop browser's right-click context menu.

* [Install xIFr from Mozilla Firefox Add-ons](https://addons.mozilla.org/firefox/addon/xifr/?utm_source=github.com)

In principle xIFr a "cross-browser compatible" webextension. While it currently _ain't_ available via Chrome Web Store, it still works with Chrome/Chromium based browsers if you install [the webextension](https://github.com/StigNygaard/xIFr/releases) directly from your local filesystem. 
However the _"deep search" functionality_ (described below) requires Firefox 63 (compatible) or newer. 

To create a browser extension from this repository, simply create a zip-file with content from the _WebExtension_ folder.

![Screenshot](https://www.rockland.dk/img/xIFr100-1-1400x1050.jpg)

### Why another Exif viewer?

Because I felt other Exif readers annoyed me or I felt they were missing something. It is probably a matter of personal preferences,
but you should really check the _"deep search" feature_. It works sooo well - in my own very humble opinion :-)

![Screenshot](https://www.rockland.dk/img/xIFr100-2-1400x1050.jpg)

### "Deep Search" feature?
Most other Exif viewers only works if you can right-click directly on an html _img_ element. But with "Deep Search" xIFr finds the image you want to see details about,
no matter if it is below a layer, or is defined as a background-image of another element. In 99% of the times, it just works as you expect.
You wont even know if you were right-clicking directly on an img element or not. This is in my opinion the most important feature distinguishing
xIFr from other Exif-viewers.

Also with Deep Search, you can avoid overlayered logos and icons. By shift-clicking when selecting xIFr in browser's context-menu, you will force
xIFr to look for images larger than a specified size (The size is configurable).

Deep Search is supported in **Firefox 63 or newer** (It requires an API feature currently only available in Firefox 63+). In other browser versions you can only launch xIFr if you are able to right-click _directly on_ an html _img_ element. You can get a little introduction to xIFr's features including what Deep Search does at [www.rockland.dk/xIFr/start](https://www.rockland.dk/xIFr/start/).  

### Dark Theme support


![Screenshot](https://www.rockland.dk/img/xIFr100-3-1400x1050.jpg)

### A handy Firefox tip!
Some websites overrides the browser's default right-click context menu. But you can usually hold down the _shift_ key while
right-clicking, to get the browser's native context menu back - and thus launch xIFr...

### A lot of credit to...
Vital parts of xIFr, is inherited work by various [people](https://raw.githubusercontent.com/StigNygaard/xIFr/master/WebExtension/AUTHORS)
involved with development of [wxIF](https://github.com/gcp/wxif) (xIFr is a fork of wxIF),
[FxIF](https://code.google.com/archive/p/fxif/), [JHead](http://www.sentex.net/~mwandel/jhead/) and more.
Without their work, xIFr wouldn't be.

Also thanks to [crimx](https://github.com/crimx), and his ["Get All Images in DOM" coding-post](https://blog.crimx.com/2017/03/09/get-all-images-in-dom-including-background-en/) which was great help implementing the Deep Search feature.

Finally, to help make xIFr cross-browser compatible, [browser-polyfill.js](https://github.com/StigNygaard/xIFr/tree/master/WebExtension/lib/mozilla) from
Mozilla's [webextension-polyfill project](https://github.com/mozilla/webextension-polyfill) is used.

### License

[MPL 2.0 - Mozilla Public License Version 2.0](https://raw.githubusercontent.com/StigNygaard/xIFr/master/LICENSE)

### Flickr Fixr
Are you a Flickr user? Also take a look at my [Flickr Fixr](https://github.com/StigNygaard/Stigs_Flickr_Fixr) !
