const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');
const logger = require('../utils/logger');
const kubernetesService = require('./kubernetesService');

const execAsync = promisify(exec);
const STORES_FILE = path.join(__dirname, '../../data/stores.json');
const HELM_CHART_PATH = path.join(__dirname, '../../../helm/store');

class StoreService {
  constructor() {
    this.stores = new Map();
    this.loadStores();
  }

  async loadStores() {
    try {
      const data = await fs.readFile(STORES_FILE, 'utf8');
      const stores = JSON.parse(data);
      stores.forEach(store => this.stores.set(store.id, store));
      logger.info(`Loaded ${stores.length} stores from disk`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No existing stores file found');
        await this.persistStores();
      } else {
        logger.error('Failed to load stores:', error);
      }
    }
  }

  async persistStores() {
    try {
      const stores = Array.from(this.stores.values());
      await fs.mkdir(path.dirname(STORES_FILE), { recursive: true });
      await fs.writeFile(STORES_FILE, JSON.stringify(stores, null, 2));
    } catch (error) {
      logger.error('Failed to persist stores:', error);
      throw error;
    }
  }

  async saveStore(store) {
    this.stores.set(store.id, store);
    await this.persistStores();
    return store;
  }

  async getStore(id) {
    return this.stores.get(id);
  }

  async getAllStores() {
    return Array.from(this.stores.values());
  }

  async deleteStore(id) {
    this.stores.delete(id);
    await this.persistStores();
  }

  async updateStoreStatus(id, status) {
    const store = this.stores.get(id);
    if (store) {
      store.status = status;
      store.updatedAt = new Date().toISOString();
      await this.persistStores();
    }
  }

  async deployStore(store) {
    try {
      logger.info(`Deploying store ${store.id} to namespace ${store.namespace}`);

      const valuesFile = await this.generateValuesFile(store);

      const helmCommand = `helm install ${store.id} "${HELM_CHART_PATH}" -f "${valuesFile}" --namespace ${store.namespace} --create-namespace`;
      
      const { stdout, stderr } = await execAsync(helmCommand);
      logger.info(`Helm install output: ${stdout}`);
      
      if (stderr) {
        logger.warn(`Helm install stderr: ${stderr}`);
      }

      await this.updateStoreStatus(store.id, 'running');
      logger.info(`Store ${store.id} deployed successfully`);

      await fs.unlink(valuesFile).catch(() => {});
    } catch (error) {
      logger.error(`Failed to deploy store ${store.id}:`, error);
      await this.updateStoreStatus(store.id, 'failed');
      throw error;
    }
  }

  async generateValuesFile(store) {
    const values = {
      namespace: store.namespace,
      store: {
        domain: store.domain
      },
      wordpress: {
        image: {
          pullPolicy: 'IfNotPresent'
        },
        replicas: 1,
        storage: {
          size: '5Gi',
          storageClass: 'local-path'
        },
        admin: {
          username: 'admin',
          email: store.adminEmail,
          password: 'admin123'
        }
      },
      woocommerce: {
        store: {
          name: store.storeName || 'My WooCommerce Store',
          address: '123 Main Street',
          city: 'New York',
          country: 'US:NY',
          postcode: '10001'
        },
        currency: 'USD',
        sampleProduct: {
          name: 'Sample Product',
          description: 'Sample product for your store',
          shortDescription: 'Sample product',
          price: '29.99',
          stock: 100
        }
      },
      mysql: {
        database: `wordpress_${store.id}`,
        credentials: {
          username: `wp_${store.id}`,
          password: this.generatePassword(),
          rootPassword: this.generatePassword()
        },
        storage: {
          size: '10Gi',
          storageClass: 'local-path'
        }
      },
      service: {
        type: 'ClusterIP',
        port: 80
      },
      ingress: {
        enabled: true
      },
      resources: {
        requests: {
          memory: '256Mi',
          cpu: '250m'
        },
        limits: {
          memory: '512Mi',
          cpu: '500m'
        }
      }
    };

    const valuesFile = path.join(__dirname, `../../data/values-${store.id}.yaml`);
    await fs.writeFile(valuesFile, yaml.dump(values));
    
    return valuesFile;
  }

  async uninstallStore(store) {
    try {
      logger.info(`Uninstalling store ${store.id}`);

      const helmCommand = `helm uninstall ${store.id} --namespace ${store.namespace}`;
      await execAsync(helmCommand);

      const deleteNsCommand = `kubectl delete namespace ${store.namespace}`;
      await execAsync(deleteNsCommand);

      logger.info(`Store ${store.id} uninstalled successfully`);
    } catch (error) {
      logger.error(`Failed to uninstall store ${store.id}:`, error);
      throw error;
    }
  }

  generatePassword() {
    return require('crypto').randomBytes(16).toString('hex');
  }
}

module.exports = new StoreService();
