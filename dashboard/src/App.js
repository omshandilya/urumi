import React, { useState, useEffect } from 'react';
import StoreList from './components/StoreList';
import CreateStoreForm from './components/CreateStoreForm';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function App() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStores();
    const interval = setInterval(fetchStores, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch(`${API_URL}/stores`);
      if (!response.ok) throw new Error('Failed to fetch stores');
      const data = await response.json();
      setStores(data.stores);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const createStore = async (storeData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });
      if (!response.ok) throw new Error('Failed to create store');
      await fetchStores();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteStore = async (id) => {
    if (!window.confirm('Are you sure you want to delete this store?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/stores/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete store');
      await fetchStores();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>🛍️ Urumi Store Provisioning</h1>
      </header>
      
      <main>
        {error && <div className="error">{error}</div>}
        
        <CreateStoreForm onSubmit={createStore} disabled={loading} />
        
        <StoreList 
          stores={stores} 
          onDelete={deleteStore} 
          disabled={loading}
        />
      </main>
    </div>
  );
}

export default App;
