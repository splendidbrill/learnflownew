"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Coins, 
  Crown,
  User,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Shield,
  Loader2,
  X,
  Check,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface AdminPanelProps {
  user: SupabaseUser;
}

interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  subscription_tier: string;
  credits: number;
  is_ultimate: boolean;
  xp?: number;
  streak?: number;
}

interface LedgerEntry {
  id: string;
  amount: number;
  operation: string;
  description: string;
  created_at: string;
}

const SUBSCRIPTION_TIERS = [
  { value: 'explorer', label: 'Explorer', price: '$0', color: 'text-gray-400' },
  { value: 'scholar', label: 'Scholar', price: '$20', color: 'text-blue-400' },
  { value: 'master', label: 'Master', price: '$49', color: 'text-purple-400' },
  { value: 'elite', label: 'Elite', price: '$99', color: 'text-amber-400' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const supabase = createClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Credit Modal State
  const [creditModal, setCreditModal] = useState<{
    isOpen: boolean;
    type: 'grant' | 'revoke';
    amount: number;
    description: string;
  }>({
    isOpen: false,
    type: 'grant',
    amount: 100,
    description: ''
  });
  
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  // Search users by email via backend API
  const searchUsers = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Call backend API which searches auth.users by email
      const res = await fetch(`${API_URL}/admin/users?email=${encodeURIComponent(searchQuery)}&admin_id=${user.id}`);
      
      if (!res.ok) throw new Error('Search failed');
      
      const data = await res.json();
      setSearchResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, user.id]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Fetch user ledger
  const fetchLedger = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/ledger/${userId}?admin_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data);
      }
    } catch (err) {
      console.error('Ledger fetch error:', err);
    }
  };

  // Select a user
  const handleUserSelect = async (profile: UserProfile) => {
    setSelectedUser(profile);
    await fetchLedger(profile.id);
  };

  // Grant credits
  const handleCreditOperation = async () => {
    if (!selectedUser) return;
    
    setIsLoading(true);
    try {
      const endpoint = creditModal.type === 'grant' 
        ? '/api/admin/credits/grant' 
        : '/api/admin/credits/revoke';
      
      const res = await fetch(`${API_URL}${endpoint}?admin_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          amount: creditModal.amount,
          description: creditModal.description || `${creditModal.type === 'grant' ? 'Granted' : 'Revoked'} by admin`
        })
      });
      
      if (!res.ok) throw new Error('Operation failed');
      
      const result = await res.json();
      
      // Update local state
      setSelectedUser(prev => prev ? { ...prev, credits: result.new_balance } : null);
      await fetchLedger(selectedUser.id);
      
      showNotification(`Successfully ${creditModal.type}ed ${creditModal.amount} credits`, 'success');
      setCreditModal({ ...creditModal, isOpen: false, amount: 100, description: '' });
    } catch (err) {
      showNotification('Operation failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Change subscription
  const handleSubscriptionChange = async (newTier: string) => {
    if (!selectedUser) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/subscription/change?admin_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          new_tier: newTier
        })
      });
      
      if (!res.ok) throw new Error('Failed to change subscription');
      
      setSelectedUser(prev => prev ? { ...prev, subscription_tier: newTier } : null);
      await fetchLedger(selectedUser.id);
      
      showNotification(`Subscription changed to ${newTier.toUpperCase()}`, 'success');
    } catch (err) {
      showNotification('Failed to change subscription', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
  };

  const getTierInfo = (tier: string) => {
    return SUBSCRIPTION_TIERS.find(t => t.value === tier) || SUBSCRIPTION_TIERS[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#13002b] via-[#1e0a3c] to-[#0f0518] p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Founder Control Panel</h1>
            <p className="text-amber-300/80 text-sm">Manage users, credits, and subscriptions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Search Panel */}
          <div className="lg:col-span-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-400" />
              Find User
            </h2>
            
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400 animate-spin" />
              )}
            </div>
            
            {/* Search Results */}
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleUserSelect(profile)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedUser?.id === profile.id 
                      ? 'bg-purple-500/20 border border-purple-500/30' 
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-white font-medium truncate">{profile.email}</p>
                      <p className="text-gray-400 text-xs truncate">{profile.full_name || 'No name'}</p>
                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <span className={getTierInfo(profile.subscription_tier).color}>
                          {getTierInfo(profile.subscription_tier).label}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-amber-400">{profile.credits} credits</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              
              {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <p className="text-center text-gray-500 py-4">No users found</p>
              )}
            </div>
          </div>

          {/* User Details Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {selectedUser ? (
              <>
                {/* User Card */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold text-white">
                        {selectedUser.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{selectedUser.email}</h3>
                        <p className="text-gray-400 text-sm">{selectedUser.full_name || 'No name set'}</p>
                        <p className="text-gray-500 text-xs">ID: {selectedUser.id.slice(0, 8)}...</p>
                        {selectedUser.is_ultimate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full mt-1">
                            <Crown className="w-3 h-3" /> Ultimate
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-400">{selectedUser.credits}</p>
                        <p className="text-xs text-gray-500">Credits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-400">{selectedUser.xp || 0}</p>
                        <p className="text-xs text-gray-500">XP</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Credits Control */}
                    <div className="bg-white/5 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                        <Coins className="w-4 h-4" /> Credits Management
                      </h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCreditModal({ isOpen: true, type: 'grant', amount: 100, description: '' })}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-4 rounded-lg transition-all"
                        >
                          <ArrowUpCircle className="w-4 h-4" />
                          Grant
                        </button>
                        <button
                          onClick={() => setCreditModal({ isOpen: true, type: 'revoke', amount: 100, description: '' })}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 px-4 rounded-lg transition-all"
                        >
                          <ArrowDownCircle className="w-4 h-4" />
                          Revoke
                        </button>
                      </div>
                    </div>

                    {/* Subscription Control */}
                    <div className="bg-white/5 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Subscription Tier
                      </h4>
                      <select
                        value={selectedUser.subscription_tier}
                        onChange={(e) => handleSubscriptionChange(e.target.value)}
                        disabled={isLoading}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
                      >
                        {SUBSCRIPTION_TIERS.map(tier => (
                          <option key={tier.value} value={tier.value} className="bg-[#1e0a3c] text-white">
                            {tier.label} ({tier.price})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Credit Ledger */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-purple-400" />
                      Credit History
                    </h4>
                    <button
                      onClick={() => fetchLedger(selectedUser.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {ledgerEntries.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {ledgerEntries.map((entry) => (
                        <div 
                          key={entry.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              entry.amount >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                              {entry.amount >= 0 
                                ? <ArrowUpCircle className="w-4 h-4 text-green-400" />
                                : <ArrowDownCircle className="w-4 h-4 text-red-400" />
                              }
                            </div>
                            <div>
                              <p className="text-white text-sm">{entry.description || entry.operation}</p>
                              <p className="text-gray-500 text-xs">
                                {new Date(entry.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className={`font-mono font-bold ${
                            entry.amount >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {entry.amount >= 0 ? '+' : ''}{entry.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No credit history</p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <User className="w-10 h-10 text-purple-400 opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Select a User</h3>
                <p className="text-gray-400 max-w-sm">
                  Search for a user by email to view their details and manage their credits and subscription.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Credit Modal */}
      {creditModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e0a3c] border border-white/10 rounded-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {creditModal.type === 'grant' ? (
                  <><ArrowUpCircle className="w-5 h-5 text-green-400" /> Grant Credits</>
                ) : (
                  <><ArrowDownCircle className="w-5 h-5 text-red-400" /> Revoke Credits</>
                )}
              </h3>
              <button
                onClick={() => setCreditModal({ ...creditModal, isOpen: false })}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount</label>
                <input
                  type="number"
                  value={creditModal.amount}
                  onChange={(e) => setCreditModal({ ...creditModal, amount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={creditModal.description}
                  onChange={(e) => setCreditModal({ ...creditModal, description: e.target.value })}
                  placeholder="Reason for credit change..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>
              
              {/* Quick amounts */}
              <div className="flex gap-2">
                {[10, 50, 100, 500, 1000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCreditModal({ ...creditModal, amount })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      creditModal.amount === amount
                        ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCreditModal({ ...creditModal, isOpen: false })}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreditOperation}
                disabled={isLoading || creditModal.amount <= 0}
                className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  creditModal.type === 'grant'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm {creditModal.type === 'grant' ? 'Grant' : 'Revoke'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification.show && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};
