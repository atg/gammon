let SQL = require('sequelize');

let db = new SQL({
  dialect: 'sqlite',
  storage: 'db.sqlite3',
});

exports.Widgets = db.define('widget', {
  username: { type: SQL.CHAR({ length: 99 }), unique: true },
});

