const ghostList = require('./ghost-list.js');

function getAaGhostList(vars) {
  return Object.entries(vars).map(([key, value]) => {
    if (key.startsWith("user_") && value?.ghost) {
      const name = key.replaceAll("user_", "");

      return {
        ...value,
        name,
        image: name && name in ghostList ? ghostList[name].image : "/ghosts/default.png"
      }
    } else {
      return null
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

module.exports = getAaGhostList;