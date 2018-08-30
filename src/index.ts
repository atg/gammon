import _ from 'lodash';
import fs from 'fs';
import pathlib from 'path';
import util from 'util';
import assert from 'assert';

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

let fs_lstat = util.promisify(fs.lstat);

function logError(...args: any[]) {
  console.log('[gammon]', ...args);
  process.exit(1);
}
function slugify(name: string): string {
  name = name.toLowerCase();
  return (name.match(/[a-z0-9]+/ig) || []).filter(x => !!x).join('-');
}
function zpad2(n: number): string {
  if (n < 10) return '0'+n;
  else return ''+n;
}
function generateFilename(name: string, ext: string): string {
  let d = new Date();
  let YYYY = d.getUTCFullYear();
  let MM = zpad2(d.getUTCMonth());
  let DD = zpad2(d.getUTCDate());
  let hh = zpad2(d.getUTCHours());
  let mm = zpad2(d.getUTCMinutes());
  let ss = zpad2(d.getUTCSeconds());
  return `${YYYY}-${MM}-${DD}-${hh}${mm}${ss}_${slugify(name)}.${ext}`;
}

const pj = pathlib.join;

// let headStat; try { headStat = fs.lstatSync(headPath); } catch { }
function checkPermissions(path: string) {
  let stat; try { stat = fs.lstatSync(path); } catch { }
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

function diffMaps<K,V>(m1: Map<K,V>, m2: Map<K,V>, eq: (key: K, a: V, b: V) => boolean) {
  let result = {
    same: new Map<K, [V, V]>(),
    changed: new Map<K, [V, V]>(),
    leftOnly: new Map<K, V>(),
    rightOnly: new Map<K, V>(),
  };
  let keys1 = _.toArray(m1.keys()) as any as K[];
  let keys2 = _.toArray(m2.keys()) as any as K[];
  let keys = new Set<K>(_.concat(keys1, keys2));
  for (let k of keys) {
    let a = m1.get(k);
    let b = m2.get(k);
    
    if (!m1.has(k)) {
      result.rightOnly.set(k, b!);
    } else if (!m2.has(k)) {
      result.leftOnly.set(k, a!);
    } else {
      if (eq(k, a!, b!)) {
        result.same.set(k, [a!, b!]);
      } else {
        result.changed.set(k, [a!, b!]);
      }
    }
  }
  return result;
}

class Gammon {
  root = 'db';
  main() {
    // process.chdir(pathlib.join(__dirname, '..'));
    // console.log(process.cwd());
    const root = this.root;

    // Look for db/ directory
    if (!fs.existsSync(root)) {
      return logError(`${root}/ directory does not exist in cwd`);
    }
    
    // Make sure there is a db/history directory
    try { fs.mkdirSync(pj(root, 'history')); } catch { }
    try { fs.mkdirSync(pj(root, 'log')); } catch { }

    
    let stagingPath = pj(root, 'staging.js');
    let headPath = pj(root, 'head.js');

    let stagingStat; try { stagingStat = fs.lstatSync(stagingPath); } catch { }
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
        this.makeMigration(args[1]);
      } else {
        logError('Please give a migration name');
      }
    }
  }
  makeMigration(migrationName: string) {
    // copy staging.js into history
    let root = this.root;
    if (!slugify(migrationName)) {
      logError('Invalid migration name');
    }
    let stagingPath = pj(this.root, 'staging.js');
    let stagingContent = fs.readFileSync(stagingPath, 'utf8');
    if (!stagingContent.trim()) {
      logError(`${stagingPath} is empty`);
    }
    let filename = generateFilename(migrationName, 'js');
    
    let historyPath = pj(root, 'history');
    let historyElements = fs.readdirSync(historyPath);
    if (historyElements.length) {
      let head = _.max(historyElements);
      let headPath = pj(historyPath, head!);
      let headContent = fs.readFileSync(headPath, 'utf8')
      console.log(this.diff(headPath, stagingPath));
    }

    // fs.copyFileSync(stagingPath, pj(root, 'history', filename), fs.constants.COPYFILE_EXCL);
  }
  diff(older: string, newer: string) {
    // This is safe because I said so
    let m1 = new Map(Object.entries(require(pj(process.cwd(), newer))));
    let m2 = new Map(Object.entries(require(pj(process.cwd(), older))));

    function* findModels(m: any): IterableIterator<[string, any]> {
      for (let [k, v] of m) {
        if (v.options && v.tableName && v.associations && v.attributes && v.tableAttributes) {
          // It's a model!
          yield [v.tableName, v];
        }
      }
    }
    function* findAttributes(model: any): IterableIterator<[string, any]> {
      for (let [k, v] of Object.entries(model.tableAttributes)) {
        yield [k, v];
      }
    }
    function findIndexes(model: any) {
      return model.options.indexes || [];
    }
    let models1 = new Map(findModels(m1));
    let models2 = new Map(findModels(m2));

    let log: any[] = [];
    let modelsDiff = diffMaps(models1, models2, (tableName: string, a: any, b: any) => {
      let attrs1 = new Map(findAttributes(a));
      let attrs2 = new Map(findAttributes(b));
      let attrsDiff = diffMaps(attrs1, attrs2, (key: string, atA: any, atB: any) => {
        // console.log(key, JSON.stringify(atA), JSON.stringify(atB));
        delete atA.Model; // this will cause the model to always show as different
        delete atB.Model;
        // console.log(_.isEqual(atA, atB));
        // console.log(util.inspect(atA, true, null, false));

        // atA.type = _.toString(atA.type);
        // atB.type = _.toString(atB.type);
        // console.log(JSON.stringify(atA, null, 4));
        // process.exit();
        return _.isEqual(atA, atB);
      });

      for (let [name, newAttr] of attrsDiff.leftOnly) {
        log.push(['attr.create', tableName, name]);
      }
      for (let [name, oldAttr] of attrsDiff.rightOnly) {
        log.push(['attr.drop', tableName, name]);
      }
      for (let [name, [model1, model2]] of attrsDiff.changed) {
        log.push(['attr.changed', tableName, name]);
      }

      let indexes1 = new Map(findIndexes(a));
      let indexes2 = new Map(findIndexes(b));
      // let indexesDiff = diffMaps(indexes1, indexes2, (key: string, atA: any, atB: any) => {
      //   // console.log(key, JSON.stringify(atA), JSON.stringify(atB));
      //   delete atA.Model; // this will cause the model to always show as different
      //   delete atB.Model;
      //   // console.log(_.isEqual(atA, atB));
      //   // console.log(util.inspect(atA, true, null, false));

      //   // atA.type = _.toString(atA.type);
      //   // atB.type = _.toString(atB.type);
      //   // console.log(JSON.stringify(atA, null, 4));
      //   // process.exit();
      //   return _.isEqual(atA, atB);
      // });

      // for (let [name, newIndex] of indexesDiff.leftOnly) {
      //   log.push(['index.create', tableName, name]);
      // }
      // for (let [name, oldIndex] of indexesDiff.rightOnly) {
      //   log.push(['index.drop', tableName, name]);
      // }
      // for (let [name, [model1, model2]] of indexesDiff.changed) {
      //   log.push(['index.changed', tableName, name]);
      // }

      // TODO also need to diff other things
      return attrsDiff.same.size === attrs1.size;
      // return _.isEqual(attrs1, attrs2);
    });
    // console.log(models1);
    // console.log(models2);
    // console.log(modelsDiff);

    for (let [name, newModel] of modelsDiff.leftOnly) {
      log.push(['model.create', name]);
    }
    for (let [name, oldModel] of modelsDiff.rightOnly) {
      log.push(['model.drop', name]);
    }

    console.log(log);


    // for (let [k, v] of m1) {
    //   let v2 = v as any;
    //   console.log(k, Object.keys(v));
    //   console.log(v2.tableAttributes);
    // }
  }
}

if (require.main === module) { (new Gammon).main(); }