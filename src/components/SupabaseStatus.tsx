import React from 'react';
import { Database } from 'lucide-react';

interface SupabaseStatusProps {
  isConnected: boolean;
  loading: boolean;
  error?: string | null;
}

const SupabaseStatus: React.FC<SupabaseStatusProps> = ({ 
  isConnected, 
  loading, 
  error 
}) => {
  const getStatusColor = () => {
    if (loading) return 'text-yellow-500';
    return isConnected ? 'text-green-500' : 'text-red-500';
  };

  return (
    <div className="flex justify-end">
      <Database className={`h-5 w-5 ${getStatusColor()}`} />
    </div>
  );
};

export default SupabaseStatus;