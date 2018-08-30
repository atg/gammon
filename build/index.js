"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
/*

'sequelize',
  '_booleanAttributes',
  '_dataTypeChanges',
  '_dataTypeSanitizers',
  '_dateAttributes',
  '_defaultValues',
  '_geometryAttributes',
  '_hasBooleanAttributes',
  '_hasDateAttributes',
  '_hasDefaultValues',
  '_hasGeometryAttributes',
  '_hasHstoreAttributes',
  '_hasJsonAttributes',
  '_hasPrimaryKeys',
  '_hasRangeAttributes',
  '_hasReadOnlyAttributes',
  '_hasVirtualAttributes',
  '_hstoreAttributes',
  '_isBooleanAttribute',
  '_isDateAttribute',
  '_isGeometryAttribute',
  '_isHstoreAttribute',
  '_isJsonAttribute',
  '_isPrimaryKey',
  '_isRangeAttribute',
  '_isReadOnlyAttribute',
  '_isVirtualAttribute',
  '_jsonAttributes',
  '_rangeAttributes',
  '_readOnlyAttributes',
  '_schema',
  '_schemaDelimiter',
  '_scope',
  '_scopeNames'
  '_timestampAttributes',
  '_virtualAttributes',

  'associations',
  'attributes',
  'autoIncrementAttribute',
  'fieldAttributeMap',
  'fieldRawAttributesMap',
  'options',
  'primaryKeyAttribute',
  'primaryKeyAttributes',
  'primaryKeyField',
  'primaryKeys',
  'rawAttributes',
  'tableAttributes',
  'tableName',
  'underscored',
  'uniqueKeys',
*/
let fs_lstat = util_1.default.promisify(fs_1.default.lstat);
function logError(...args) {
    console.log('[gammon]', ...args);
    process.exit(1);
}
function slugify(name) {
    name = name.toLowerCase();
    return (name.match(/[a-z0-9]+/ig) || []).filter(x => !!x).join('-');
}
function zpad2(n) {
    if (n < 10)
        return '0' + n;
    else
        return '' + n;
}
function generateFilename(name, ext) {
    let d = new Date();
    let YYYY = d.getUTCFullYear();
    let MM = zpad2(d.getUTCMonth());
    let DD = zpad2(d.getUTCDate());
    let hh = zpad2(d.getUTCHours());
    let mm = zpad2(d.getUTCMinutes());
    let ss = zpad2(d.getUTCSeconds());
    return `${YYYY}-${MM}-${DD}-${hh}${mm}${ss}_${slugify(name)}.${ext}`;
}
function fromEntries(entries) {
    let obj = {};
    for (let [k, v] of entries) {
        obj[k] = v;
    }
    return obj;
}
function normalizeSQLTypeInner(t) {
    if (lodash_1.default.isFunction(t)) {
        return { type: t() };
    }
    else if (lodash_1.default.isFunction(t.type)) {
        t.type = t.type();
        return t;
    }
    else if (!t.type) {
        return { type: t };
    }
    else {
        let obj = fromEntries(Object.entries(t));
        return obj;
    }
}
function normalizeSQLType(t) {
    t = normalizeSQLTypeInner(t);
    let name = t.type.key;
    let options = removePrivates(t.type.options);
    t.type = [name, options];
    return removePrivates(t);
}
const pj = path_1.default.join;
function removePrivates(v) {
    if (lodash_1.default.isPlainObject(v)) {
        return fromEntries(Object.entries(v).filter(kv => (kv[0][0] !== '_')));
    }
    return v;
}
const quote = (j) => JSON.stringify(j, (k, v) => removePrivates(v));
// let headStat; try { headStat = fs.lstatSync(headPath); } catch { }
function checkPermissions(path) {
    let stat;
    try {
        stat = fs_1.default.lstatSync(path);
    }
    catch { }
    if (stat) {
        let mode = stat.mode;
        let modes = [(mode & 0o700) >> 6, (mode & 0o070) >> 3, mode & 0o007];
        for (let m of modes) {
            if (!(m === 4 || m == 0)) {
                logError(`${path} file has invalid mode, should be read-only.`);
                return process.exit(1);
            }
        }
    }
}
// function* same<T>(s1: Map<T>, s1: Set<T>): Set<T> {
//   let s3 = new Set<T>();
//   for (let )
// }
function diffMaps(m1, m2, eq) {
    let result = {
        same: new Map(),
        changed: new Map(),
        leftOnly: new Map(),
        rightOnly: new Map(),
    };
    let keys1 = lodash_1.default.toArray(m1.keys());
    let keys2 = lodash_1.default.toArray(m2.keys());
    let keys = new Set(lodash_1.default.concat(keys1, keys2));
    for (let k of keys) {
        let a = m1.get(k);
        let b = m2.get(k);
        if (!m1.has(k)) {
            result.rightOnly.set(k, b);
        }
        else if (!m2.has(k)) {
            result.leftOnly.set(k, a);
        }
        else {
            if (eq(k, a, b)) {
                result.same.set(k, [a, b]);
            }
            else {
                result.changed.set(k, [a, b]);
            }
        }
    }
    return result;
}
class Gammon {
    constructor() {
        this.root = 'db';
    }
    main() {
        // process.chdir(pathlib.join(__dirname, '..'));
        // console.log(process.cwd());
        const root = this.root;
        // Look for db/ directory
        if (!fs_1.default.existsSync(root)) {
            return logError(`${root}/ directory does not exist in cwd`);
        }
        // Make sure there is a db/history directory
        try {
            fs_1.default.mkdirSync(pj(root, 'history'));
        }
        catch { }
        try {
            fs_1.default.mkdirSync(pj(root, 'log'));
        }
        catch { }
        try {
            fs_1.default.mkdirSync(pj(root, 'migrations'));
        }
        catch { }
        let stagingPath = pj(root, 'staging.js');
        let headPath = pj(root, 'head.js');
        let stagingStat;
        try {
            stagingStat = fs_1.default.lstatSync(stagingPath);
        }
        catch { }
        if (!stagingStat) {
            return logError(`${root}/staging.js file does not exist. Please create it.`);
        }
        // checkPermissions(headPath);
        // let items = fs.readdirSync(pj(root, 'history'));
        // for (let name of items) {
        //   let ext = pathlib.extname(name);
        //   // if (ext === '.ts' || ext === '.js')
        // }
        // console.log(items);
        let args = process.argv.slice(2);
        if (args[0] === 'make') {
            if (typeof args[1] === 'string') {
                this.makeMigration(args.slice(1).join(' '));
            }
            else {
                logError('Please give a migration name');
            }
        }
    }
    makeMigration(migrationName) {
        // copy staging.js into history
        let root = this.root;
        if (!slugify(migrationName)) {
            logError('Invalid migration name');
        }
        let stagingPath = pj(this.root, 'staging.js');
        let stagingContent = fs_1.default.readFileSync(stagingPath, 'utf8');
        if (!stagingContent.trim()) {
            logError(`${stagingPath} is empty`);
        }
        let filenameJs = generateFilename(migrationName, 'js');
        let filenameTxt = generateFilename(migrationName, 'txt');
        let historyPath = pj(root, 'history');
        let logPath = pj(root, 'log');
        let migrationsPath = pj(root, 'migrations');
        let historyElements = fs_1.default.readdirSync(historyPath);
        if (historyElements.length) {
            let head = lodash_1.default.max(historyElements);
            let headPath = pj(historyPath, head);
            let headContent = fs_1.default.readFileSync(headPath, 'utf8');
            let [logs, migrations] = this.diff(headPath, stagingPath);
            fs_1.default.writeFileSync(pj(logPath, filenameTxt), logs);
            fs_1.default.writeFileSync(pj(migrationsPath, filenameJs), migrations);
        }
        fs_1.default.copyFileSync(stagingPath, pj(root, 'history', filenameJs), fs_1.default.constants.COPYFILE_EXCL);
    }
    diff(older, newer) {
        // This is safe because I said so
        let m1 = new Map(Object.entries(require(pj(process.cwd(), newer))));
        let m2 = new Map(Object.entries(require(pj(process.cwd(), older))));
        function* findModels(m) {
            for (let [k, v] of m) {
                if (v.options && v.tableName && v.associations && v.attributes && v.tableAttributes) {
                    // It's a model!
                    yield [v.tableName, v];
                }
            }
        }
        function* findAttributes(model) {
            for (let [k, v] of Object.entries(model.tableAttributes)) {
                yield [k, v];
            }
        }
        function* findIndexes(model) {
            for (let index of model.options.indexes || []) {
                yield [index.name, index];
            }
        }
        let models1 = new Map(findModels(m1));
        let models2 = new Map(findModels(m2));
        let log = [];
        let migration = [];
        let modelsDiff = diffMaps(models1, models2, (tableName, a, b) => {
            let attrs1 = new Map(findAttributes(a));
            let attrs2 = new Map(findAttributes(b));
            let attrsDiff = diffMaps(attrs1, attrs2, (key, atA, atB) => {
                // console.log(key, JSON.stringify(atA), JSON.stringify(atB));
                delete atA.Model; // this will cause the model to always show as different
                delete atB.Model;
                // possibilities
                // foo: SQL.TEXT
                // foo: SQL.TEXT()
                // foo: SQL.TEXT({ options })
                atA = normalizeSQLType(atA);
                atB = normalizeSQLType(atB);
                // console.log(JSON.stringify(atA));
                // process.exit();
                // if  
                // console.log(_.isEqual(atA, atB));
                // console.log(util.inspect(atA, true, null, false));
                // atA.type = _.toString(atA.type);
                // atB.type = _.toString(atB.type);
                // console.log(JSON.stringify(atA, null, 4));
                // process.exit();
                return lodash_1.default.isEqual(atA, atB);
            });
            for (let [name, newAttr] of attrsDiff.leftOnly) {
                log.push(['attr.create', tableName, name]);
                migration.push(`createAttribute(db, qi, ${quote(tableName)}, ${quote(name)}, ${quote(normalizeSQLType(newAttr))});`);
            }
            for (let [name, oldAttr] of attrsDiff.rightOnly) {
                log.push(['attr.drop', tableName, name]);
                migration.push(`dropAttribute(db, qi, ${quote(tableName)}, ${quote(name)});`);
            }
            for (let [name, [attr1, attr2]] of attrsDiff.changed) {
                log.push(['attr.changed', tableName, name]);
                migration.push(`changedAttribute(db, qi, ${quote(tableName)}, ${quote(name)}, ${quote(normalizeSQLType(attr2))});`);
            }
            let indexes1 = new Map(findIndexes(a));
            let indexes2 = new Map(findIndexes(b));
            let indexesDiff = diffMaps(indexes1, indexes2, (key, atA, atB) => {
                // console.log(key, JSON.stringify(atA), JSON.stringify(atB));
                delete atA.Model; // this will cause the model to always show as different
                delete atB.Model;
                // console.log(_.isEqual(atA, atB));
                // console.log(util.inspect(atA, true, null, false));
                // atA.type = _.toString(atA.type);
                // atB.type = _.toString(atB.type);
                // console.log(JSON.stringify(atA, null, 4));
                // process.exit();
                return lodash_1.default.isEqual(atA, atB);
            });
            for (let [name, newIndex] of indexesDiff.leftOnly) {
                log.push(['index.create', tableName, name]);
                migration.push(`createIndex(db, qi, ${quote(tableName)}, ${quote(name)}, ${quote(newIndex)});`);
            }
            for (let [name, oldIndex] of indexesDiff.rightOnly) {
                log.push(['index.drop', tableName, name]);
                migration.push(`dropIndex(db, qi, ${quote(tableName)}, ${quote(name)});`);
            }
            for (let [name, [index1, index2]] of indexesDiff.changed) {
                log.push(['index.changed', tableName, name]);
                migration.push(`changedIndex(db, qi, ${quote(tableName)}, ${quote(name)}, ${quote(index2)});`);
            }
            // TODO also need to diff other things
            return attrsDiff.same.size === attrs1.size;
            // return _.isEqual(attrs1, attrs2);
        });
        // console.log(models1);
        // console.log(models2);
        // console.log(modelsDiff);
        for (let [name, newModel] of modelsDiff.leftOnly) {
            log.push(['model.create', name]);
            migration.push(`createTable(db, qi, ${quote(name)});`);
        }
        for (let [name, oldModel] of modelsDiff.rightOnly) {
            log.push(['model.drop', name]);
            migration.push(`dropTable(db, qi, ${quote(name)});`);
        }
        let logs = log.map(line => line.join(' ')).join('\n');
        let migrations = migration.join('\n\n');
        return [logs, migrations];
        // for (let [k, v] of m1) {
        //   let v2 = v as any;
        //   console.log(k, Object.keys(v));
        //   console.log(v2.tableAttributes);
        // }
    }
}
if (require.main === module) {
    (new Gammon).main();
}
//# sourceMappingURL=index.js.map