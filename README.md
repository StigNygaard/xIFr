# xIFr Beta

xIFr is a viewer for EXIF, IPTC and XMP metadata in jpg image files. It is currently "in beta", but mostly feature complete.
Launch it from the browser's right-click context menu.

xIFr is a "cross-browser compatible" webextension. It works with Firefox 56+, Chrome 74+ and compatible browsers(*).
But a _"deep search" functionality_ requires Firefox 63 (compatible) or newer.

* [Install on Mozilla Firefox (or compatible)](https://addons.mozilla.org/firefox/addon/xifr?src=external-github)
* Install on Google Chrome (or compatible) - _not yet available_

(*) Additionally compatible browsers includes Tor, Waterfox, Brave, Opera and the [new chrominum based MS Edge](https://www.microsoftedgeinsider.com/download).

![Screenshot](https://addons.cdn.mozilla.net/user-media/previews/full/222/222226.png)

### Beta version?

Do you know the frustrating feeling of working on something new, that's not quite in the state you originally imagined it should be in before showing it to
the World. But getting the last details and polishing done is a bit boring and progressing rather slow, and you really don't want to keep it for yourself anymore?
This is _it_, xIFr Beta !

### Why another Exif viewer?

Because I felt other Exif readers annoyed me or I felt they were missing something. It is probably a matter of personal preferences,
but you should really check the _"deep search" feature_. It works sooo well - in my own very humble opinion :-)

![Screenshot](https://addons.cdn.mozilla.net/user-media/previews/full/222/222227.png)

### "Deep Search" feature?
Most other Exif viewers only works if you can right-click directly on an html _img_ element. But xIFr finds the image you want to see details about,
no matter if it is below a layer, or is defined as a background-image of another element. In 99% of the times, it just works as you expect.
You wont even know if you were right-clicking directly on an img element or not. This is in my opinion the most important feature distinguishing
xIFr from other Exif-viewers.

Also with Deep Search, you can avoid overlayered logos and icons. By shift-clicking when selecting xIFr in browser's context-menu, you will force
xIFr to look for images larger than a minimum-size (This minimum size is planned to be configurable in final release).

Deep Search is supported in Firefox 63 or newer (If using Chrome or earlier versions of Firefox, there's unfortunately no deep search support,
and you you can only launch xIFr by right-clicking directly on an img-element).

### Dark Theme support
On Windows 10 1903+ and MacOS Mojave 10.14+, system-setting for [preferred Dark Theme](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-color-scheme) should be supported when installing xIFr on Firefox 67+ or Chrome 76+. Might also be supported on other platforms.

![Screenshot](https://addons.cdn.mozilla.net/user-media/previews/full/222/222236.png)

### When will it be out of beta?
When I released the beta-version in summer 2019, I expected to follow up with a "final" version a month or two later.
But as we are approaching end of 2019, I must admit I haven't coded a single line of code on xIFr since the initial release.
In the beginning I just needed a little break, but later other stuff has been stealing my time and energy.
But I promise, there _WILL_ be a version 1.0, and hopefully not too long into 2020. Don't expect big changes though.
There will be an _Options page_ with a few configuration options, but besides that xIFr 1.0 is planned to look and work very much like the current beta. 

### A handy Firefox tip!
Some websites overrides the browser's default right-click context menu. But you can always hold down the _shift_ key while
right-clicking, to get the browser's native context menu back - and thus launch xIFr...

### A lot of credit to...
Vital parts of xIFr, is inherited work by various [people](https://raw.githubusercontent.com/StigNygaard/xIFr/master/AUTHORS)
involved with development of [wxIF](https://github.com/gcp/wxif) (xIFr is a fork of wxIF),
[FxIF](https://code.google.com/archive/p/fxif/), [JHead](http://www.sentex.net/~mwandel/jhead/) and more.
Without their work, xIFr wouldn't be.

Also thanks to [crimx](https://github.com/crimx), and his ["Get All Images in DOM" coding-post](https://blog.crimx.com/2017/03/09/get-all-images-in-dom-including-background-en/) which was great help implementing the Deep Search feature.

Finally, to help make xIFr cross-browser compatible, [browser-polyfill.js](https://github.com/StigNygaard/xIFr/tree/master/lib/mozilla) from
Mozilla's [webextension-polyfill project](https://github.com/mozilla/webextension-polyfill) is used.

### License

MPL 2.0

### Flickr Fixr
Love photos? Flickr user? Also try my [Flickr Fixr](https://github.com/StigNygaard/Stigs_Flickr_Fixr) !
