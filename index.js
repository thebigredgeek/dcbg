#!/usr/bin/env node
var axios = require('axios');
var args = require('yargs').argv;

function help () {
  process.stdout.write(`
This command line utility is used to get the next active target code for blue/green deployments on docker cloud.\n
Usage:
  ./getNextTargetCode
    --user=[username]             Docker cloud username.
    --token=[token]               Docker cloud API token associated with the username.
    --target=[service].[stack]    The docker cloud internal domain name for the service in question.
    --lb=[loadbalancer]           The docker cloud hostname for the loadbalancer.  Must be on target stack.
    --options=(blue,green)        (optional) The suffix codes used for the service.  Defaults to blue,green
    --active                      (optional) Flag to return active code rather than next code
  \n`);
  process.exit(0);
}

function errUser () {
  process.stderr.write('ERROR: --user parameter must be used to specify a docker cloud username');
  process.exit(1);
}

function errToken () {
  process.stderr.write('ERROR: --token parameter must be used to specify a docker cloud API token matched with --user');
  process.exit(1);
}

function errTarget () {
  process.stderr.write('ERROR: --target parameter must be used to specify the intended target in the format of [service].[stack]');
  process.exit(1);
}

function errOptions () {
  process.stderr.write('ERROR: --options parameter use requires exactly two options delimited by a comma');
  process.exit(1);
}

function errLb () {
  process.stderr.write('ERROR: --lb parameter must be used to specify the service load balancer')
  process.exit(1);
}

function getStack (stack, name) {
  return axios.get('https://cloud.docker.com/api/app/v1/stack/')
  .then((res) => {
    var stk = res.data.objects.filter((s) => s.name === stack).pop();
    if (!stk) throw new Error(`Stack ${stack} not found`);
    return stk;
  })
  .catch((e) => {
    if (e.message) throw e;
    throw new Error(`Could not fetch stacks`)
  })
}

function getCurrentService (service, stack, lb, options, stk) {
  return axios.all(
    stk.services.map((srv) => axios.get(`https://cloud.docker.com${srv}`))
  ).then((res) => {

    var services = res.map((r) => r.data);
    var loadbalancer = services.filter((s) => s.name === lb).pop();

    if (!loadbalancer) throw new Error(`Loadbalancer ${lb}.${stack} not found`);

    if (
      !loadbalancer.linked_to_service ||
      loadbalancer.linked_to_service.length < 1
    ) throw new Error(`Loadbalancer ${lb}.${stack} is not linked to any services`);

    if (
      loadbalancer.linked_to_service.length > 1
    ) throw new Error(`Loadbalancer ${lb}.${stack} is linked more than one service`);

    const linkedService = loadbalancer.linked_to_service.pop();

    if (
      options.indexOf(
        linkedService.name.split('-').pop()
      ) === -1
    ) throw new Error(`Service ${service}.${stack} linked to ${lb}.${stack} does not contain suffix from provided options "${options.join('" or "')}"`);

    var srv = services.filter((s) => s.name === linkedService.name).pop();

    if(!srv) throw new Error(`Service ${service}.${stack} not found`);

    return srv;
  })
  .catch((e) => {
    if (e.message) throw e;
    throw new Error(`Could not fetch services for stack ${stack}`);
  })
}

function getAlternateCode () {
  return 'blue'
}

function main () {

  if (args.help) return help();

  var target = args.target;
  var lb = args.lb;

  if (
    typeof target !== 'string' ||
    target.indexOf(' ') !== -1 ||
    target.split('.').length !== 2
  ) return errTarget();

  var splitTarget = target.split('.');

  var service = splitTarget[0];
  var stack = splitTarget[1];

  if (typeof lb !== 'string') return errLb();

  var options = (args.options || 'blue,green').split(',');

  if (options.length !== 2) return errOptions();

  if (!args.user) return errUser();

  if (!args.token) return errToken();

  var auth = new Buffer(args.user + ':' + args.token).toString('base64');

  axios.interceptors.request.use((config) => {
    var cfg = Object.assign({}, config);
    cfg.headers.Authorization = `Basic ${auth}`;
    cfg.headers.Accept = 'application/json';
    return cfg;
  });

  getStack(stack)
  .then(getCurrentService.bind(null, service, stack, lb, options))
  .then((srv) => {
    var currentCode = srv.name.split('-').pop();
    var i = options.indexOf(currentCode);
    if (!args.active) return options.filter((opt) => opt !== currentCode).pop();
    return currentCode;
  })
  .then((code) => {
    process.stdout.write(code);
    process.exit(0);
  })
  .catch((e) => {
    console.trace(e);
    process.stderr.write(`ERROR: ${e.message}\n`);
    process.exit(1);
  });
}

main();
