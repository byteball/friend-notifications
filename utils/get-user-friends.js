function getUserFriends(vars, address) {
  const friends = []; // string[]: addresses or ghost names
  const prefix = `friend_${address}_`;

  for (const key in vars) {
    if (key.startsWith(prefix)) {
      friends.push(vars[key]);
    }
  }

  return friends;
}

module.exports = getUserFriends;