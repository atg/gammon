changedAttribute(db, qi, "widgets", "username", {"type":["CHAR",{"length":98}],"unique":true,"fieldName":"username","field":"username"});

createAttribute(db, qi, "widget2s", "email", {"type":["TEXT",{}],"unique":true,"fieldName":"email","field":"email"});

createTable(db, qi, "widget3s");