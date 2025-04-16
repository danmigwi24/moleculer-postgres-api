// mixins/encryption.mixin.js
const bcrypt = require("bcrypt");

module.exports = {
  methods: {
    async encryptPassword(password) {
      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(password, salt);
  },
    /**
     * Hash a password
     * 
     * @param {String} password - Plain password
     * @returns {String} - Hashed password
     */
    async hashPassword(password) {
      if (!password) {
        throw new Error("Password is required for hashing");
      }
      const salt = await bcrypt.genSalt(10);
      return bcrypt.hash(password, salt);
    },

    /**
     * Compare a password with hash
     * 
     * @param {String} password - Plain password
     * @param {String} hash - Hashed password
     * @returns {Boolean} - Result of comparison
     */
    async comparePassword(password, hash) {
      console.log(`password ${password} hash ${hash}`)
      if (!password || !hash) {
        throw new Error("Both password and hash are required for comparison");
      }
      return bcrypt.compare(password, hash);
    }
  }
};