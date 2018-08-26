
const Base = require('sdk-base');
const { parserMap } = require('../parser');

const STATS = {
    IDLE: 0,
    RUNNING: 1
};

class Runner extends Base {
    constructor(options) {
        super(options);
        this.state = STATS.IDLE;
        this.lastEndTime = Date.now();
    }

    get name() {
        return this.options.name;
    }

    get file() {
        return this.options.file;
    }

    get rundir() {
        return this.options.rundir;
    }

    get logger() {
        return this.options.logger;
    }

    async start() {
        const name = 'metrix-runner:' + this.name;
    
        if (this.cache) {
            this.logger.info(`[${name}] 当前存在缓存，使用缓存`);
            // 如果当前有缓存，直接将缓存传出去；
            const data = this.cache;
            this.cache = null;
            return data;
        }
        
        if (this.state === STATS.IDLE) {
            this.logger.info(`[${name}] Runner 处于空闲状态，启动 Runner`);
            // 如果空闲状态，则启动 runner；
            this.state = STATS.RUNNING;

            const data = await this._start();

            this.state = STATS.IDLE;
            
            //  不需要缓存此次记录 - 返回出结果；
            return data;
        }

        if (this.state === STATS.RUNNING) {
            this.logger.warn(`[${name}] Runner 当前已经是运行状态，无法再次开启 Runner`);
            // 如果是运行状态，返回空对象（这种情况出现的场景是高频调用采集器）；
            return {};
        }
    }

    async _start() {
        const Parser = parserMap.get(this.name)
        const { name, file, rundir } = this;
        const parser = new Parser({
            name, file, rundir,
            duration: Date.now() - this.lastEndTime
        });

        await parser.ready();

        this.lastEndTime = Date.now();

        return parser.result;
    }
}

const runners = new Map();

exports.getMetric = async function(options) {
    for (let [name, file] of Object.entries(options.files || [])) {
        if (!runners.has(name)) {
            runners.set(name, new Runner({
                name,
                file,
                rundir: options.rundir,
                logger: options.logger
            }));
        }
    }

    console.log(options.files);
    const promises = [];

    for (let [, runner] of runners) {
        promises.push(
            runner.start()
        );
    }

    const results = await Promise.all(promises);

    return results.reduce((prev, item) => {
        return Object.assign(prev, item);
    }, {});
}