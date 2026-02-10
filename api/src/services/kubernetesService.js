const k8s = require('@kubernetes/client-node');
const logger = require('../utils/logger');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class KubernetesService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  async getStoreStatus(namespace) {
    try {
      const { stdout } = await execAsync(`kubectl get pods -n ${namespace} -o json`);
      const podsData = JSON.parse(stdout);
      
      if (!podsData.items || podsData.items.length === 0) {
        return 'provisioning';
      }

      const allRunning = podsData.items.every(pod => {
        return pod.status.phase === 'Running' && 
               pod.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
      });

      if (allRunning) {
        return 'running';
      }

      const anyFailed = podsData.items.some(pod => {
        return pod.status.phase === 'Failed' || pod.status.phase === 'CrashLoopBackOff';
      });

      if (anyFailed) {
        return 'failed';
      }

      return 'provisioning';
    } catch (error) {
      if (error.message.includes('NotFound') || error.message.includes('not found')) {
        return 'not_found';
      }
      logger.warn(`Failed to get status for namespace ${namespace}`);
      return 'unknown';
    }
  }
}

module.exports = new KubernetesService();
