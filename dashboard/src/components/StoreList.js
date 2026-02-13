import React from 'react';

const StoreList = ({ stores, onDelete, disabled }) => {
  const getStatusBadge = (status) => {
    const statusMap = {
      provisioning: { label: 'Provisioning', className: 'status-provisioning' },
      running: { label: 'Ready', className: 'status-ready' },
      failed: { label: 'Failed', className: 'status-failed' },
      unknown: { label: 'Unknown', className: 'status-unknown' }
    };
    
    const statusInfo = statusMap[status] || statusMap.unknown;
    return <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="store-list">
      <h2>Stores ({stores.length})</h2>
      
      {stores.length === 0 ? (
        <p className="empty-state">No stores yet. Create your first store above!</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Store ID</th>
              <th>Status</th>
              <th>Domain</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map(store => (
              <tr key={store.id}>
                <td><code>{store.id}</code></td>
                <td>{getStatusBadge(store.status)}</td>
                <td>
                  {store.status === 'running' ? (
                    <a href={`http://${store.domain}`} target="_blank" rel="noopener noreferrer">
                      {store.domain}
                    </a>
                  ) : (
                    store.domain
                  )}
                </td>
                <td>{formatDate(store.createdAt)}</td>
                <td>
                  <button
                    onClick={() => onDelete(store.id)}
                    disabled={disabled}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default StoreList;
