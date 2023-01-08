/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

/*
 *  Interpreter for XML XMP data.
 */

function xmpClass() {
  // Parses and reads through the XMP document within the file.
  this.parseXML = function (dataObj, xml) {
    let parser = new DOMParser();
    let utf8decoder = new TextDecoder('utf-8');
    let xmlString = utf8decoder.decode(xml);
    if (xmlString.indexOf('>') < xmlString.indexOf('<')) {
      // We are probably missing the first character("<") in xmp data. This dirty fix which apparently usually works...
      xmlString = '<' + xmlString; // But do xIFr have an addressing bug, or or is it an error in the image file???
      pushWarning(dataObj, "[xmp]", "Addressing/offset error when trying to read XMP, but was able to recover from it(?)...");
    }
    let packetEnd = xmlString.indexOf('<?xpacket end="w"?>');
    if (packetEnd === -1) {
      packetEnd = xmlString.indexOf("<?xpacket end='w'?>");
    }
    if (packetEnd >= 0) {
      xmlString = xmlString.substring(0, packetEnd + 19); // Ignore any content after packetEnd
    }
    // There is at least one program which includes a null byte at the end of the document.
    // The parser doesn't like this, so shorten the length by one byte of the last one is null.
    if (xmlString?.length && xmlString.charCodeAt(xmlString.length - 1) === 0) {
      xmlString = xmlString.substring(0, xmlString.length - 1);
    }

    context.info("xmp xmlString (length=" + xmlString.length + ") :\n" + xmlString);
    let dom = parser.parseFromString(xmlString, 'application/xml'); // alternatively "text/xml" ?

    if (dom.documentElement.nodeName === 'parsererror') {
      context.error("Error parsing XML - xmp xmlString: \n" + xmlString);
      throw ("Error parsing XMP in parseXML()");
      // pushError(dataObj, "[xmp]", ex);
      // return;
    }

    var val;

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "Credit");
    if (val) {
      dataObj.Creditline = val;
    }

    // Creators come in an ordered list. Get them all.
    val = getXMPOrderedArray(dom, "http://purl.org/dc/elements/1.1/", "creator", "").filter( item => item && item.trim()); // filter skips empty values
    if (val?.length) {
      dataObj.Creator = val.join("; "); // todo: Make a Set and handle later like Software or Keywords?
    }

    let contactInfo = dom.getElementsByTagNameNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CreatorContactInfo");
    if (contactInfo.length) {
      // https://www.iptc.org/std/photometadata/specification/IPTC-PhotoMetadata-2019.1.html#metadata-structures
      let adr = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrExtadr");
      if (!adr) {
        adr = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrExtadr");
      }
      if (adr) dataObj.CreatorAddress = adr;
      let city = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrCity");
      if (!city) {
        city = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrCity");
      }
      if (city) dataObj.CreatorCity = city;
      let region = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrRegion");
      if (!region) {
        region = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrRegion");
      }
      if (region) dataObj.CreatorRegion = region;
      let postalcode = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrPcode");
      if (!postalcode) {
        postalcode = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrPcode");
      }
      if (postalcode) dataObj.CreatorPostalCode = postalcode;
      let country = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrCtry");
      if (!country) {
        country = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiAdrCtry");
      }
      if (country) dataObj.CreatorCountry = country;
      let phoneNumbers = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiTelWork");
      if (!phoneNumbers) {
        phoneNumbers = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiTelWork");
      }
      if (phoneNumbers) dataObj.CreatorPhoneNumbers = phoneNumbers;
      let emails = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiEmailWork");
      if (!emails) {
        emails = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiEmailWork");
      }
      if (emails) dataObj.CreatorEmails = emails;
      let urls = getSubvalues(contactInfo[0], "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiUrlWork");
      if (!urls) {
        urls = contactInfo[0].getAttributeNS("http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "CiUrlWork");
      }
      if (urls) dataObj.CreatorURLs = urls;
    }

    val = getXMPOrderedArray(dom, "http://iptc.org/std/Iptc4xmpExt/2008-02-29/", "PersonInImage", "").filter( item => item && item.trim()); // filter skips empty values
    if (val?.length) {
      dataObj.Depicted = new Set(val);
    }
    // There's also an "PersonInImageWDetails": https://www.iptc.org/std/photometadata/specification/IPTC-PhotoMetadata#person-shown-in-the-image

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "City");
    if (val) {
      dataObj.City = val;
    }

    val = getXMPValue(dom, "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/", "Location");
    if (val) {
      dataObj.Sublocation = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "State");
    if (val) {
      dataObj.ProvinceState = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "Country");
    if (val) {
      dataObj.CountryName = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "Headline");
    if (val) {
      dataObj.Headline = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "Instructions");
    if (val) {
      dataObj.Instructions = val;
    }

    // only use if not already set
    if (!dataObj.Software) {
      val = getXMPValue(dom, "http://ns.adobe.com/xap/1.0/", "CreatorTool");
      if (val) {
        dataObj.Software = val;
      }
    }

    val = getXMPOrderedArray(dom, "http://ns.adobe.com/xap/1.0/mm/", "History", "http://ns.adobe.com/xap/1.0/sType/ResourceEvent#", "softwareAgent").filter( item => item && item.trim()); // filter skips empty values
    if (val?.length) {
      if (!dataObj.Software) {
        dataObj.Software = val[val.length - 1]; // [length-1] = Last is the last used ?
      }
      dataObj.AdditionalSoftware = [...(new Set(val.filter(s => s !== dataObj.Software)))]; // Might become an empty array
    }

    val = getXMPValue(dom, "http://ns.adobe.com/xap/1.0/mm/", "PreservedFileName");
    if (val) {
      dataObj.PreservedFileName = val;
    }

    const lang = fxifUtils.getLang();
    // Build a regular expression to be used to test the language
    // alternatives available in the XMP.
    const langTest = new RegExp("^" + lang.match(/^[a-z]{2,3}/i), "i");

    if (!dataObj.Headline) {
      val = getXMPAltValue(dom, "http://purl.org/dc/elements/1.1/", "title", langTest);
      if (val) {
        dataObj.Headline = val;
      }
    }

    //    val = getXMPAltValue(dom, "dc:description", langTest);
    val = getXMPAltValue(dom, "http://purl.org/dc/elements/1.1/", "description", langTest);
    if (val) {
      dataObj.Caption = val;
    }

    val = getXMPAltValue(dom, "http://purl.org/dc/elements/1.1/", "rights", langTest);
    if (val) {
      dataObj.Copyright = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/xap/1.0/rights/", "WebStatement"); // License URL used by Google Image Search
    if (val) {
      dataObj.LicenseURL = val;
    } else {
      val = getXMPValue(dom, "http://creativecommons.org/ns#", "license"); // License URL
      if (val) {
        dataObj.LicenseURL = val;
      }
    }
    val = getXMPAltValue(dom, "http://ns.adobe.com/xap/1.0/rights/", "UsageTerms", langTest); // Written terms (but might be or include license URL?)
    if (val && !dataObj.LicenseURL || val && val !== dataObj.LicenseURL) {
      dataObj.UsageTerms = val;
    }

    // Subjects (keywords) comes in a list/set. Get them all.
    val = getXMPOrderedArray(dom, "http://purl.org/dc/elements/1.1/", "subject", "").filter( item => item && item.trim()); // filter skips empty values
    if (val?.length) {
      dataObj.Keywords = new Set(val); // todo: If already set by iptc, make sure we have same or more keywords!
    }

    // XMP:EXIF

    val = getXMPValue(dom, "http://ns.adobe.com/tiff/1.0/", "Make");
    if (val) {
      dataObj.Make = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/tiff/1.0/", "Model");
    if (val) {
      dataObj.Model = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/aux/", "Lens"); // Also look for lens data in exifEX? https://exiftool.org/TagNames/XMP.html#exifEX (AUX is deprecated!?)
    if (val) {
      dataObj.Lens = val;
    }

    if (!dataObj.Date) {
      val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "DateTimeDigitized");
      if (val) {
        let date = readAndFormatISODate(val);
        if (date) {
          dataObj.Date = date;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "CreateDate");
    if (val) {
      let date = readAndFormatISODate(val);
      if (date) {
        dataObj.Date = date;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "DateTimeOriginal");
    if (val) {
      let date = readAndFormatISODate(val);
      if (date) {
        dataObj.Date = date;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "FNumber"); // expects a rational (eg. "5/1")
    if (!val) {
      val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ApertureValue");
    } // expects a rational (eg. "4643856/1000000")
    if (val) {
      try {
        dataObj.ApertureFNumber = "ƒ/" + parseRational(val).toFixed(1);
      } catch (ex) {
        if (!dataObj.ApertureFNumber) {
          dataObj.ApertureFNumber = val;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "FocalLength"); // expects a rational (eg. "2000/10")
    if (val) {
      try {
        dataObj.FocalLength = parseRational(val).toFixed(1);
      } catch (ex) {
        if (!dataObj.FocalLength) {
          dataObj.FocalLength = val;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "FocalLengthIn35mmFilm");
    if (!val)
      // this name is no official one, but written by some applications
    {
      val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "FocalLengthIn35mmFormat");
    }
    if (val) {
      dataObj.FocalLength35mmEquiv = val;
    }

    if (dataObj.FocalLength) {
      var fl = stringBundle.getFormattedString("millimeters", [dataObj.FocalLength]);
      if (dataObj.FocalLength35mmEquiv) {
        dataObj.FocalLength35mmEquiv = parseFloat(dataObj.FocalLength35mmEquiv);
        fl += ", " + stringBundle.getFormattedString("35mmequiv", [dataObj.FocalLength35mmEquiv.toFixed(0)]);
      }

      dataObj.FocalLengthText = fl;
    }

    if (!dataObj.Distance) {
      val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "SubjectDistance");
      if (!val) {
        val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/aux/", "ApproximateFocusDistance");
      }
      if (val) {
        try {
          var distance = parseRational(val).toFixed(2);
          if (distance < 0 || distance > 4294967294) {
            dataObj.Distance = stringBundle.getString("infinite");
          } else {
            dataObj.Distance = stringBundle.getFormattedString("meters", [distance]);
          }
        } catch (ex) {
          if (!dataObj.Distance) {
            dataObj.Distance = val;
          }
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ExposureTime");
    if (val) {
      try {
        var et = "";
        val = parseRational(val);
        if (val < 0.010) {
          et = stringBundle.getFormattedString("seconds", [val.toFixed(4)]);
        } else {
          et = stringBundle.getFormattedString("seconds", [val.toFixed(3)]);
        }
        if (val <= 0.5) {
          et += " (1/" + Math.floor(0.5 + 1 / val).toFixed(0) + ")";
        }
        dataObj.ExposureTime = et;
      } catch (ex) {
        if (!dataObj.ExposureTime) {
          dataObj.ExposureTime = val;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/aux/", "IsMergedHDR");
    if (val && val.match(/^true$/i)) {
      dataObj.MergedCaptures = "HDR";
    }
    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/aux/", "IsMergedPanorama");
    if (val && val.match(/^true$/i)) {
      if (dataObj.MergedCaptures) {
        dataObj.MergedCaptures += " + Panorama"
      } else {
        dataObj.MergedCaptures = "Panorama";
      }
    }

    val = getXMPValue(dom, "http://cipa.jp/exif/1.0/", "CameraOwnerName");
    if (!val) {
      val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/aux/", "OwnerName");
    }
    if (val) {
      dataObj.CameraOwnerName = val;
    }

    val = getXMPValue(dom, "http://cipa.jp/exif/1.0/", "Temperature"); // Ambient temperature - unit: Celsius  - Also see binEXIF 0x9400
    if (val) {
      val = parseRational(val);
      dataObj.Temperature = stringBundle.getFormattedString("celsius", [val.toFixed(1)]);
    }

    var el = dom.getElementsByTagNameNS("http://ns.adobe.com/exif/1.0/", "Flash");
    var flashFired = 0;
    var flashFunction = 0;
    var flashMode = 0;
    var redEyeMode = 0;
    var flashReturn = 0;
    if (el.length) {
      // Flash values can occur in two ways, as attribute values of flash
      // like <Flash Fired="True"/>
      // and as child values, e.g. <Flash><Fired>True</Fired></Flash>
      // We've to deal with both and also mixed as a bonus.
      flashFired = getSubvalues(el[0], "http://ns.adobe.com/exif/1.0/", "Fired");
      if (!flashFired) {
        flashFired = el[0].getAttributeNS("http://ns.adobe.com/exif/1.0/", "Fired");
      }
      flashFunction = getSubvalues(el[0], "http://ns.adobe.com/exif/1.0/", "Function");
      if (!flashFunction) {
        flashFunction = el[0].getAttributeNS("http://ns.adobe.com/exif/1.0/", "Function");
      }
      flashMode = Number(getSubvalues(el[0], "http://ns.adobe.com/exif/1.0/", "Mode"));
      if (!flashMode) {
        flashMode = Number(el[0].getAttributeNS("http://ns.adobe.com/exif/1.0/", "Mode"));
      }
      redEyeMode = getSubvalues(el[0], "http://ns.adobe.com/exif/1.0/", "RedEyeMode");
      if (!redEyeMode) {
        redEyeMode = el[0].getAttributeNS("http://ns.adobe.com/exif/1.0/", "RedEyeMode");
      }
      flashReturn = Number(getSubvalues(el[0], "http://ns.adobe.com/exif/1.0/", "Return"));
      if (!flashReturn) {
        flashReturn = Number(el[0].getAttributeNS("http://ns.adobe.com/exif/1.0/", "Return"));
      }

      var fu;
      var addfunc = [];
      if (flashFired && flashFired.match(/^true$/i)) {
        fu = stringBundle.getString("yes");

        if (flashMode == 3) {
          addfunc.push(stringBundle.getString("auto"));
        } else if (flashMode == 1) {
          addfunc.push(stringBundle.getString("enforced"));
        }

        if (redEyeMode && redEyeMode.match(/^true$/i)) {
          addfunc.push(stringBundle.getString("redeye"));
        }

        if (flashReturn == 3) {
          addfunc.push(stringBundle.getString("returnlight"));
        } else if (flashReturn == 2) {
          addfunc.push(stringBundle.getString("noreturnlight"));
        }
      } else {
        fu = stringBundle.getString("no");
        if (flashFunction && flashFunction.match(/^true$/i)) {
          addfunc.push(stringBundle.getString("noflash"));
        } else if (flashMode == 2) {
          addfunc.push(stringBundle.getString("enforced"));
        } else if (flashMode == 3) {
          addfunc.push(stringBundle.getString("auto"));
        }
      }

      if (addfunc.length) {
        fu += " (" + addfunc.join(", ") + ")";
      }

      dataObj.FlashUsed = fu;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/tiff/1.0/", "Orientation");
    if (!dataObj.Orientation && val && val > 0) {
      if (val <= 8) {
        dataObj.Orientation = stringBundle.getString("orientation" + val);
      } else {
        dataObj.Orientation = stringBundle.getString("unknown") + " (" + val + ")";
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/tiff/1.0/", "ImageHeight");
    if (val) {
      dataObj.Length = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/tiff/1.0/", "ImageWidth");
    if (val) {
      dataObj.Width = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "FocalPlaneXResolution");
    if (val) {
      dataObj.FocalPlaneXRes = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "FocalPlaneResolutionUnit");
    if (val) {
      if (val.search(/^\d+$/) !== -1) // Unfortunately there are applications which write non-number values
      {
        switch (Number(val)) {
          case 1:
            dataObj.FocalPlaneUnits = 25.4;
            break; // inches
          case 2:
            // According to the information I was using, 2 means meters.
            // But looking at the Canon powershot's files, inches is the only
            // sensible value.
            dataObj.FocalPlaneUnits = 25.4;
            break;
          case 3:
            dataObj.FocalPlaneUnits = 10;
            break; // centimeter
          case 4:
            dataObj.FocalPlaneUnits = 1;
            break; // millimeter
          case 5:
            dataObj.FocalPlaneUnits = .001;
            break; // micrometer
        }
      } else if (!dataObj.FocalPlaneUnits) {
        dataObj.FocalPlaneUnits = val;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ExposureBiasValue");
    if (val) {
      try {
        val = parseRational(val).toFixed(2);
        if (val === 0) {
          dataObj.ExposureBias = stringBundle.getString("none");
        } else
          // add a + sign before positive values
        {
          dataObj.ExposureBias = (val > 0 ? '+' : '') + stringBundle.getFormattedString("ev", [val]);
        }
      } catch (ex) {
        if (!dataObj.ExposureBias) {
          dataObj.ExposureBias = val;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "WhiteBalance");
    if (val) {
      if (val.search(/^\d+$/) !== -1) // Unfortunately there are applications which write non-number values
      {
        switch (Number(val)) {
          case 0:
            dataObj.WhiteBalance = stringBundle.getString("auto");
            break;
          case 1:
            dataObj.WhiteBalance = stringBundle.getString("manual");
            break;
        }
      } else if (!dataObj.WhiteBalance) {
        dataObj.WhiteBalance = val;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "LightSource");
    if (val) {
      if (val.search(/^\d+$/) !== -1) // Unfortunately there are applications which write non-number values
      {
        switch (Number(val)) {
          case 0:
            dataObj.LightSource = stringBundle.getString("unknown");
            break;
          case 1:
            dataObj.LightSource = stringBundle.getString("daylight");
            break;
          case 2:
            dataObj.LightSource = stringBundle.getString("fluorescent");
            break;
          case 3:
            dataObj.LightSource = stringBundle.getString("incandescent");
            break;
          case 4:
            dataObj.LightSource = stringBundle.getString("flash");
            break;
          case 9:
            dataObj.LightSource = stringBundle.getString("fineweather");
            break;
          case 10:
            dataObj.LightSource = stringBundle.getString("cloudy");
            break;
          case 11:
            dataObj.LightSource = stringBundle.getString("shade");
            break;
          case 12:
            dataObj.LightSource = stringBundle.getString("daylightfluorescent");
            break;
          case 13:
            dataObj.LightSource = stringBundle.getString("daywhitefluorescent");
            break;
          case 14:
            dataObj.LightSource = stringBundle.getString("coolwhitefluorescent");
            break;
          case 15:
            dataObj.LightSource = stringBundle.getString("whitefluorescent");
            break;
          case 24:
            dataObj.LightSource = stringBundle.getString("studiotungsten");
            break;
          default: //Quercus: 17-1-2004 There are many more modes for this, check Exif2.2 specs
          // If it just says 'unknown' or we don't know it, then
          // don't bother showing it - it doesn't add any useful information.
        }
      } else if (!dataObj.LightSource) {
        dataObj.LightSource = val;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "MeteringMode");
    if (val) {
      if (val.search(/^\d+$/) !== -1) // Unfortunately there are applications which write non-number values
      {
        switch (Number(val)) {
          case 0:
            dataObj.MeteringMode = stringBundle.getString("unknown");
            break;
          case 1:
            dataObj.MeteringMode = stringBundle.getString("average");
            break;
          case 2:
            dataObj.MeteringMode = stringBundle.getString("centerweight");
            break;
          case 3:
            dataObj.MeteringMode = stringBundle.getString("spot");
            break;
          case 4:
            dataObj.MeteringMode = stringBundle.getString("multispot");
            break;
          case 5:
            dataObj.MeteringMode = stringBundle.getString("matrix");
            break;
          case 6:
            dataObj.MeteringMode = stringBundle.getString("partial");
            break;
        }
      } else if (!dataObj.MeteringMode) {
        dataObj.MeteringMode = val;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ExposureProgram");
    if (val) {
      if (val.search(/^\d+$/) !== -1) // Unfortunately there are applications which write non-number values
      {
        switch (Number(val)) {
          case 1:
            dataObj.ExposureProgram = stringBundle.getString("manual");
            break;
          case 2:
            dataObj.ExposureProgram = stringBundle.getString("program") + " ("
              + stringBundle.getString("auto") + ")";
            break;
          case 3:
            dataObj.ExposureProgram = stringBundle.getString("apriority")
              + " (" + stringBundle.getString("semiauto") + ")";
            break;
          case 4:
            dataObj.ExposureProgram = stringBundle.getString("spriority")
              + " (" + stringBundle.getString("semiauto") + ")";
            break;
          case 5:
            dataObj.ExposureProgram = stringBundle.getString("creative");
            break;
          case 6:
            dataObj.ExposureProgram = stringBundle.getString("action");
            break;
          case 7:
            dataObj.ExposureProgram = stringBundle.getString("portrait");
            break;
          case 8:
            dataObj.ExposureProgram = stringBundle.getString("landscape");
            break;
          default:
            break;
        }
      } else if (!dataObj.ExposureProgram) {
        dataObj.ExposureProgram = val;
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ExposureIndex");
    if (val) {
      if (!dataObj.ExposureIndex) {
        try {
          dataObj.ExposureIndex = parseRational(val).toFixed(0);
        } catch (ex) {
          dataObj.ExposureIndex = val;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ExposureMode");
    if (val) {
      if (val.search(/^\d+$/) !== -1) // Unfortunately there are applications which write non-number values
      {
        switch (Number(val)) {
          case 0: // Automatic
            break;
          case 1:
            dataObj.ExposureMode = stringBundle.getString("manual");
            break;
          case 2:
            dataObj.ExposureMode = stringBundle.getString("autobracketing");
            break;
        }
      } else if (!dataObj.ExposureProgram) {
        dataObj.ExposureProgram = val;
      }
    }

    val = getXMPOrderedArray(dom, "http://ns.adobe.com/exif/1.0/", "ISOSpeedRatings").filter( item => item && item.trim()); // filter skips empty values
    if (val && val.length) {
      dataObj.ISOequivalent = val.join(", ");
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "DigitalZoomRatio");
    if (val) {
      try {
        var floatVal = parseRational(val);
        if (floatVal > 1) {
          dataObj.DigitalZoomRatio = floatVal.toFixed(3) + "x";
        }
      } catch (ex) {
        if (!dataObj.DigitalZoomRatio) {
          dataObj.DigitalZoomRatio = val;
        }
      }
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "ColorSpace");
    if (val) {
      context.debug("xmp.js 1 colorspace val =" + val);
      let postfix = (context.INFO || context.DEBUG ? " (xmp)" : "");
      if (val == 1) {
        dataObj.ColorSpace = "sRGB" + postfix;
      } else if (val == 2) {
        dataObj.ColorSpace = "Adobe RGB" + postfix;
      }
    }

    if (!dataObj.ColorSpace) {
      // At least Photoshop writes ColorSpace "uncalibrated" though it uses
      // a defined colorspace which is documented in ICCProfile
      val = getXMPValue(dom, "http://ns.adobe.com/photoshop/1.0/", "ICCProfile");
      if (val) {
        context.debug("xmp.js 1.1 colorspace val =" + val);
        dataObj.ColorSpace = val;
      }
    }

    // GPS stuff

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "GPSAltitude");
    var gpsAlt;
    if (val) {
      gpsAlt = parseRational(val);
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "GPSAltitudeRef");
    var gpsAltRef = 0;
    if (val) {
      gpsAltRef = Number(val);
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "GPSImgDirection");
    var gpsImgDir;
    if (val) {
      gpsImgDir = parseRational(val);
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "GPSImgDirectionRef");
    var gpsImgDirRef = 'M';
    if (val) {
      gpsImgDirRef = val;
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "GPSLatitude");
    var gpsLat;
    if (val) {
      gpsLat = parseGPSPos(val);
    }

    val = getXMPValue(dom, "http://ns.adobe.com/exif/1.0/", "GPSLongitude");
    var gpsLon;
    if (val) {
      gpsLon = parseGPSPos(val);
    }

    // use dms format by default
    var degFormat = "dms";
    var degFormatter = fxifUtils.dd2dms;
    try {
      // 0 = DMS, 1 = DD, 2 = DM
      if (fxifUtils.getPreferences().getIntPref("gpsFormat") == 1) {
        // but dd if the user wants that
        degFormat = "dd";
        degFormatter = fxifUtils.dd2dd;
      } else if (fxifUtils.getPreferences().getIntPref("gpsFormat") == 2) {
        // but dd if the user wants that
        degFormat = "dm";
        degFormatter = fxifUtils.dd2dm;
      }
    } catch (e) {
    }

    if (gpsLat !== undefined) {
      let gpsArr = degFormatter(Math.abs(gpsLat));
      gpsArr.push(gpsLat < 0 ? 'S' : 'N');
      dataObj.GPSLat = stringBundle.getFormattedString("latlon" + degFormat, gpsArr);
    }
    if (gpsLon !== undefined) {
      let gpsArr = degFormatter(Math.abs(gpsLon));
      gpsArr.push(gpsLon < 0 ? 'W' : 'E');
      dataObj.GPSLon = stringBundle.getFormattedString("latlon" + degFormat, gpsArr);
    }
    if (gpsAlt !== undefined) {
      dataObj.GPSAlt = stringBundle.getFormattedString("meters", [gpsAlt * (gpsAltRef ? -1.0 : 1.0)]);
    }
    if (gpsImgDir !== undefined && (gpsImgDirRef === 'M' || gpsImgDirRef === 'T')) {
      dataObj.GPSImgDir = stringBundle.getFormattedString("dir" + gpsImgDirRef, [gpsImgDir]);
    }

    // Get the straight decimal values without rounding.
    // For creating links to map services.
    if (gpsLat !== undefined && gpsLon !== undefined) {
      dataObj.GPSPureDdLat = gpsLat / 3600;
      dataObj.GPSPureDdLon = gpsLon / 3600;
    }

    // GPano
    // https://www.exiv2.org/tags-xmp-GPano.html

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "UsePanoramaViewer");
    if (val) {
      dataObj.GPano_UsePanoramaViewer = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "CaptureSoftware");
    if (val) {
      dataObj.GPano_CaptureSoftware = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "StitchingSoftware");
    if (val) {
      dataObj.GPano_StitchingSoftware = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "ProjectionType");
    if (val) {
      dataObj.GPano_ProjectionType = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "PoseHeadingDegrees");
    if (val) {
      dataObj.GPano_PoseHeadingDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "PosePitchDegrees");
    if (val) {
      dataObj.GPano_PosePitchDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "PoseRollDegrees");
    if (val) {
      dataObj.GPano_PoseRollDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "InitialViewHeadingDegrees");
    if (val) {
      dataObj.GPano_InitialViewHeadingDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "InitialViewPitchDegrees");
    if (val) {
      dataObj.GPano_InitialViewPitchDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "InitialViewRollDegrees");
    if (val) {
      dataObj.GPano_InitialViewRollDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "InitialHorizontalFOVDegrees");
    if (val) {
      dataObj.GPano_InitialHorizontalFOVDegrees = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "FirstPhotoDate");
    if (val) {
      dataObj.GPano_FirstPhotoDate = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "LastPhotoDate");
    if (val) {
      dataObj.GPano_LastPhotoDate = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "SourcePhotosCount");
    if (val) {
      dataObj.GPano_SourcePhotosCount = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "ExposureLockUsed");
    if (val) {
      dataObj.GPano_ExposureLockUsed = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "CroppedAreaImageWidthPixels");
    if (val) {
      dataObj.GPano_CroppedAreaImageWidthPixels = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "CroppedAreaImageHeightPixels");
    if (val) {
      dataObj.GPano_CroppedAreaImageHeightPixels = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "FullPanoWidthPixels");
    if (val) {
      dataObj.GPano_FullPanoWidthPixels = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "FullPanoHeightPixels");
    if (val) {
      dataObj.GPano_FullPanoHeightPixels = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "CroppedAreaLeftPixels");
    if (val) {
      dataObj.GPano_CroppedAreaLeftPixels = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "CroppedAreaTopPixels");
    if (val) {
      dataObj.GPano_CroppedAreaTopPixels = val;
    }

    val = getXMPValue(dom, "http://ns.google.com/photos/1.0/panorama/", "InitialCameraDolly");
    if (val) {
      dataObj.GPano_InitialCameraDolly = val;
    }

  };

  // Parse a GPS datum.
  // It's stored like 49,9.8672N
  function parseGPSPos(gpsstring) {
    var matches = gpsstring.match(/^(\d{1,3}).([0-9.]+) ?([NSEW])$/);
    if (matches) {
      var val = matches[1] * 3600 + matches[2] * 60;
      val = val * (matches[3] === 'N' || matches[3] === 'E' ? 1.0 : -1.0);
      return val;
    }
  }

  // Parse rational numbers. They consist of two
  // integers separated by a "/".
  // Throws an exception if ratstring contains to rational
  // (yes, this happens, e.g. GIMP 2.8.10 writes "f/3,5" for FNumber)?
  function parseRational(ratstring) {
    var matches = ratstring.match(/^([+-]?\d+)\/(\d+)$/);
    if (matches) {
      var val = matches[1] / matches[2];
      return val;
    } else {
      throw ("ratstring contains no rational");
    }
  }

  // Since JS can't really parse dates and keep timezone informations,
  // I only break the string up and reformat it without any JS functions.
  // Input format is YYYY-MM-DD[THH:MM[:SS[.SS]][+/-HH:MM|Z]] and
  // Output format is YYYY-MM-DD HH:MM:SS [+/-HH:MM]
  // It’s a bit more relaxted than the specification in that
  // the time zone information is optional
  function readAndFormatISODate(datestring) {
    var exploded_date = datestring.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?:(:\d{2})(?:\.\d+)?)?([+-]\d{2}:\d{2}|Z)?)?$/);
    if (exploded_date) {
      date = exploded_date[1];
      if (typeof exploded_date[2] != 'undefined' && exploded_date[2].length > 0) {
        date += ' ' + exploded_date[2];
        if (typeof exploded_date[3] != 'undefined' && exploded_date[3].length > 0) {
          date += exploded_date[3];
        }
        if (typeof exploded_date[4] != 'undefined' && exploded_date[4].length > 0) {
          if (exploded_date[4] === 'Z') {
            date += ' UTC';
          } else {
            date += ' ' + exploded_date[4];
          }
        } else {
          date += ' ' + stringBundle.getString("noTZ");
        }
      }
      return date;
    }
  }

  // Retrieves a property stored somewhere in the XMP data.
  // Unfortunately there are at least two common ways a property
  // value can be stored.
  // 1. As property value of an element
  // 2. As content of an element with name of the property
  // This function looks for both and returns the first one found.
  // ns "http://ns.adobe.com/exif/1.0/"
  // property "FNumber"
  function getXMPValue(dom, ns, property) {
    var el = dom.getElementsByTagNameNS(ns, property);
    if (el.length && el[0].hasChildNodes()) {
      return el[0].firstChild.nodeValue;
    }

    var list = dom.getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "Description");

    for (var i = 0; i < list.length; i++) {
      var attr = list[i].getAttributeNS(ns, property);
      if (attr) {
        return attr;
      }
    }
  }

  // Gets names and descriptions that can be available
  // in multiple alternative languages.
  // But only those in the first structure with the
  // given property name is fetched.
  function getXMPAltValue(dom, ns, property, langTest) {
    var val;

    var propertyList = dom.getElementsByTagNameNS(ns, property);

    // go through all the property elements (though there should
    // only be one)
    for (let i = 0; i < propertyList.length && !val; i++) {
      let entriesList = propertyList[0].getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "li");

      for (let j = 0; j < entriesList.length; j++) {
        // found a non empty entry with fitting language
        if (entriesList[j].hasChildNodes() && langTest.test(entriesList[j].getAttribute("xml:lang"))) {
          val = entriesList[j].firstChild.nodeValue;
          break;
        }
      }
    }
    // our language wasn't found or its entry was empty
    for (let i = 0; i < propertyList.length && !val; i++) {
      let entriesList = propertyList[0].getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "li");

      for (let j = 0; j < entriesList.length; j++) {
        // found a non empty entry with fitting language
        if (entriesList[j].hasChildNodes() &&
          entriesList[j].getAttribute("xml:lang") === "x-default") {
          val = entriesList[j].firstChild.nodeValue;
          break;
        }
      }
    }

    return val;
  }

  function getSubvalues(dom, ns, property) {
    var val;
    var list = dom.getElementsByTagNameNS(ns, property);
    if (list.length) {
      if (list[0].hasChildNodes()) {
        var fc = list[0].firstChild;
        if (fc.nodeType === Node.TEXT_NODE) {
          val = fc.nodeValue;
        }
      }
    }

    return val;
  }

  // Get all entries from an ordered array.
  // Elements might be straight text nodes or come
  // with a property qualifier in a more complex organisation like
  // values as properties of the li element.
  // Currently the getElementsByTagNameNS() methods are used
  // for Firefox 2 (Gecko 1.8) compatibility. These are ugly and
  // complicated. Should remove this when Firefox 3 is widespread.
  //function getXMPOrderedArray(dom, property)
  function getXMPOrderedArray(dom, ns, property, attrNS, attrName) {
    var valarray = [];

    let el = dom.getElementsByTagNameNS(ns, property);
    if (el.length) {
      var list = el[0].getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "li");
      for (var i = 0; i < list.length; i++) {
        if (list[i].hasChildNodes()) {
          let li;
          var tmp = list[i].getElementsByTagNameNS(attrNS, attrName);
          if (tmp.length && tmp[0].hasChildNodes()) {
            li = tmp[0].firstChild;
          } else {
            li = list[i].firstChild;
          }
          if (li.nodeType === Node.TEXT_NODE) {
            valarray.push(li.nodeValue);
          }
        } else {
          // supposedly one element with values as properties
          var test = list[i].getAttributeNS(attrNS, attrName);
          if (test) {
            valarray.push(test);
          }
        }
      }
    }

    return valarray;
  }

  function pushError(dataObj, type, message) {
    if (dataObj.error)
      dataObj.error.push(stringBundle.getFormattedString("generalError", type) + ' ' + message);
    else
      dataObj.error = [stringBundle.getFormattedString("generalError", type) + ' ' + message];
  }
  function pushWarning(dataObj, type, message) {
    if (dataObj.warning)
      dataObj.warning.push(stringBundle.getFormattedString("generalWarning", type) + ' ' + message);
    else
      dataObj.warning = [stringBundle.getFormattedString("generalWarning", type) + ' ' + message];
  }

}
