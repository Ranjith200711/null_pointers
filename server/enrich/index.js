const enrichPackages = require('./enrich');
const { getFlags } = require('./flags');

enrichPackages.enrichPackages = enrichPackages;
enrichPackages.getFlags = getFlags;

module.exports = enrichPackages;
module.exports.enrichPackages = enrichPackages;
module.exports.getFlags = getFlags;
