/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

var stringBundle = {
  getString(string) {
    var translate = browser.i18n.getMessage(string);
    // WebExtension docs are lying here
    if (translate === "??" || translate === "" || translate === undefined) {
      return string;
    } else {
      return translate;
    }
  },
  getFormattedString(string, val) {
    var xlat = stringBundle.getString(string);
    if (xlat !== string) {
      return val + xlat;
    } else {
      return string + "=" + val;
    }
  }
};