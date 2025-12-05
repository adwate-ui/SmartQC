
import React from 'react';
import Layout from './components/Layout';
import ProductList from './components/ProductList';
import ProductIdentifier from './components/ProductIdentifier';
import ProductQC from './components/ProductQC';
import Login from './components/Login';
import ApiKeyModal from './components/ApiKeyModal';
import { useProductManager } from './hooks/useProductManager';
import { useAuth } from './contexts/AuthContext';
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, apiKey, logout, isAuthenticated, loading } = useAuth();
  
  // Only initialize product manager if user exists
  const {
    view, setView,
    products,
    selectedProduct,
    aiMode, setAiMode,
    selectedProductIds,
    handleToggleSelection,
    handleDeleteSelected,
    handleStartIdentification,
    handleStartQC,
    setSelectedProductId
  } = useProductManager(user?.id, apiKey);

  const handleSelectProduct = (product: any) => {
    setSelectedProductId(product.id);
    setView('product_detail');
  };

  // 1. Show Loading Spinner while Auth/Key is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading SmartQC...</p>
        </div>
      </div>
    );
  }

  // 2. Check Authentication
  if (!isAuthenticated) {
    return <Login />;
  }

  // 3. Check API Key (Modal Overlay)
  const showApiKeyModal = !apiKey;

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        return (
          <ProductList 
            products={products} 
            onSelectProduct={handleSelectProduct}
            onAddNew={() => setView('identify')}
            aiMode={aiMode}
            onToggleAiMode={setAiMode}
            selectedIds={selectedProductIds}
            onToggleSelection={handleToggleSelection}
            onDeleteSelected={handleDeleteSelected}
          />
        );
      case 'identify':
        return (
          <ProductIdentifier 
            onStartIdentification={handleStartIdentification}
            onCancel={() => setView('dashboard')}
          />
        );
      case 'product_detail':
        if (!selectedProduct) return <div className="p-8 text-center text-slate-500">Product not found.</div>;
        return (
          <ProductQC 
            product={selectedProduct}
            onStartQC={(files, isExpertMode) => handleStartQC(selectedProduct, files, isExpertMode)}
            onBack={() => setView('dashboard')}
          />
        );
      default:
        return <div>Not Found</div>;
    }
  };

  return (
    <>
      {showApiKeyModal && <ApiKeyModal />}
      
      <Layout currentView={view} setView={setView}>
        <div className="flex justify-end mb-4">
           <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                 {user?.avatar_url ? (
                   <img src={user.avatar_url} className="w-6 h-6 rounded-full" alt="avatar" />
                 ) : (
                   <UserIcon size={16} className="text-slate-500" />
                 )}
                 <span className="text-sm font-medium text-slate-700">{user?.name}</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                 <LogOut size={16} />
              </button>
           </div>
        </div>

        {renderContent()}
      </Layout>
    </>
  );
};

export default AppContent;
