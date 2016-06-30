'use strict';

const path = require('path');
const FileSystem = require('fs');

const Hogan = require('hogan.js');
const npmInstall = require('spawn-npm-install');
const Bluebird = require('bluebird');

const mkdir = Bluebird.promisify(FileSystem.mkdir);
const writeFile = Bluebird.promisify(FileSystem.writeFile);
const install = Bluebird.promisify(npmInstall);

const template = Hogan.compile(FileSystem.readFileSync(path.resolve(__dirname, 'template.hjs'), 'utf8'));
const pkg = {
  "name": "thingy",
  "version": "1.0.0",
  "description": "",
  "main": "handler.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {}
};

module.exports = class Local {
  constructor(options) {
    this.directory = options.directory;
  }

  deploy(container, functions) {
    let deps = container.dependencies;
    let packageJSON = Object.assign({ name: container.id, dependencies: deps }, pkg);
    let cwd = path.join(this.directory, container.id);
    let serial = Object.keys(deps)
      .map(key => `${key}@${deps[key]}`);

    return mkdir(cwd)
      .then(() => {
        return Bluebird.all([
          writeFile(path.join(cwd, 'package.json'), JSON.stringify(packageJSON, null, 2)),
          writeFile(path.join(cwd, 'execute.js'), compile(container, methods)),
          install(serial, { cwd }),
        ])
      })
      .catch(ex => console.error('Deployment failure', ex))
      .return(cwd);
  }

  execute(id, calls) {
    try {
      let exec = require(path.join(this.directory, id, 'execute'));
      return exec.main(calls);
    } catch(ex) {}
    return Bluebird.resolve(calls);
  }
}

function compile(container, methods) {
  methods = methods.map(fn => {
    fn.code = fn
      .code
      .toString()
      .replace(/\n/gi, '\\n')
      .replace(/"/gi, '\\"');
    return fn;
  })
  return template.render({
    container,
    methods,
    lifecycle: container.lifecycle,
  });
}
