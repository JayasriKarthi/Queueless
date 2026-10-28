import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenant } from '../../hooks/useTenant';
import { saveService, deleteServices } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import ServiceForm from '../../components/admin/ServiceForm';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import NotFound from '../NotFound';

export default function ServiceEdit() {
  const { id } = useParams();
  const { business } = useTenant();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const service = id ? business.services.find((s) => s.id === id) : null;
  if (id && !service) return <NotFound inline />;

  const onSubmit = async (data) => {
    const res = await saveService(business.id, data, service?.id);
    if (!res.ok) return toast(res.details?.[0]?.message ?? res.error, { tone: 'critical' });
    toast(service ? 'Service saved' : 'Service added');
    navigate('/admin/services');
  };
  const onDelete = async () => {
    const res = await deleteServices(business.id, [service.id]);
    setConfirm(false);
    if (!res.ok) return toast(res.error, { tone: 'critical' });
    toast('Service deleted');
    navigate('/admin/services');
  };

  return (
    <div>
      <PageHeader back="/admin/services" title={service ? service.name : 'Add service'} />
      <ServiceForm business={business} service={service} onSubmit={onSubmit} onCancel={() => navigate('/admin/services')} onDelete={service ? () => setConfirm(true) : null} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={onDelete} title={`Delete ${service?.name}?`} message="Customers will no longer be able to pick this service." confirmLabel="Delete" />
    </div>
  );
}
