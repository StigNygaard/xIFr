# xIFr

xIFr is me experimenting with a fork of wxIF. Maybe it will result in a new webextension. Maybe not. 

## Standing on the shoulders of giants
The fundament of xIFr is work by various [people](https://raw.githubusercontent.com/StigNygaard/xIFr/master/AUTHORS) involved with development of [JHead](http://www.sentex.net/~mwandel/jhead/), [FxIF](https://code.google.com/archive/p/fxif/), [wxIF](https://github.com/gcp/wxif) and more.

Below README from wxIF:

# wxIF

wxIF is a port of FxIF to WebExtensions. It adds a context menu that
allows one to view EXIF, IPTC and XMP metadata from images.

## Differences with the XUL version

* It's not possible to verify that the image can potentially contain
  EXIF data without downloading it. So the context menu item will be
  displayed even on e.g. PNG images.

* Images are redownloaded instead of being fetched directly from the
  cache. (The re-download may still be statisfied from cache).

## To Do

* The info panel layout is rather clunky. It should probably size to
  its contents somehow.

* IPTC and XMP metadata support hasn't had much if any testing.

* The i18n support is a quick hack to be able to use the messages
  from the previous version. This will need an overhaul.

* No translations from the original addon were ported.

* The coordinate notation and map provider are not configurable.

## License

MPL 2.0
