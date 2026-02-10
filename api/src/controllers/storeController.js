const { v4: uuidv4 } = require('uuid');
const storeService = require('../services/storeService');
const kubernetesService = require('../services/kubernetesService');
const logger = require('../utils/logger');

class StoreController {
  async createStore(req, res, next) {
    try {
      const { domain, adminEmail, storeName } = req.body;

      if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
      }

      const storeId = 's' + uuidv4().substring(0, 7);
      const namespace = `store-${storeId}`;

      logger.info(`Creating store ${storeId} with domain ${domain}`);

      const store = {
        id: storeId,
        namespace,
        domain,
        storeName: storeName || `Store ${storeId}`,
        adminEmail: adminEmail || `admin@${domain}`,
        adminUsername: 'admin',
        adminPassword: 'admin123',
        status: 'provisioning',
        createdAt: new Date().toISOString()
      };

      await storeService.saveStore(store);

      storeService.deployStore(store).catch(err => {
        logger.error(`Failed to deploy store ${storeId}:`, err);
        storeService.updateStoreStatus(storeId, 'failed');
      });

      res.status(202).json({
        message: 'Store creation initiated',
        store: {
          id: store.id,
          domain: store.domain,
          status: store.status,
          namespace: store.namespace,
          credentials: {
            username: store.adminUsername,
            password: store.adminPassword,
            loginUrl: `http://127.0.0.1:9090/wp-admin`
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async listStores(req, res, next) {
    try {
      const stores = await storeService.getAllStores();

      const storesWithStatus = await Promise.all(
        stores.map(async (store) => {
          try {
            const status = await kubernetesService.getStoreStatus(store.namespace);
            return { ...store, status };
          } catch (err) {
            logger.warn(`Failed to get status for store ${store.id}`);
            return store;
          }
        })
      );

      res.json({ stores: storesWithStatus });
    } catch (error) {
      next(error);
    }
  }

  async deleteStore(req, res, next) {
    try {
      const { id } = req.params;

      const store = await storeService.getStore(id);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      logger.info(`Deleting store ${id}`);

      await storeService.uninstallStore(store);
      await storeService.deleteStore(id);

      res.json({ message: 'Store deleted successfully', id });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StoreController();
