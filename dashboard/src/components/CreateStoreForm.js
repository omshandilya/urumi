import React, { useState } from 'react';

const CreateStoreForm = ({ onSubmit, disabled }) => {
  const [formData, setFormData] = useState({
    domain: '',
    storeName: '',
    adminEmail: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.domain) {
      alert('Domain is required');
      return;
    }
    onSubmit(formData);
    setFormData({ domain: '', storeName: '', adminEmail: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="create-store-form">
      <h2>Create New Store</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Domain *</label>
          <input
            type="text"
            name="domain"
            value={formData.domain}
            onChange={handleChange}
            placeholder="mystore.example.com"
            disabled={disabled}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Store Name</label>
          <input
            type="text"
            name="storeName"
            value={formData.storeName}
            onChange={handleChange}
            placeholder="My Awesome Store"
            disabled={disabled}
          />
        </div>
        
        <div className="form-group">
          <label>Admin Email</label>
          <input
            type="email"
            name="adminEmail"
            value={formData.adminEmail}
            onChange={handleChange}
            placeholder="admin@example.com"
            disabled={disabled}
          />
        </div>
        
        <button type="submit" disabled={disabled} className="btn-primary">
          {disabled ? 'Creating...' : 'Create Store'}
        </button>
      </form>
    </div>
  );
};

export default CreateStoreForm;
