const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('blk_starter', 'root', '12345', {
  host: 'localhost',
  port: 3307,
  dialect: 'mysql',
});

module.exports = sequelize;