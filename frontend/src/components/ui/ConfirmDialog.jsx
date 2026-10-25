import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Checkbox from './Checkbox';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'destructive', requireText, checkboxLabel, loading }) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (open) {
      setText('');
      setChecked(false);
    }
  }, [open]);
  const blocked = (requireText && text !== requireText) || (checkboxLabel && !checked);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'destructive' ? 'destructive' : 'primary'} disabled={blocked} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {typeof message === 'string' ? <p>{message}</p> : message}
        {requireText && <Input label={`Type "${requireText}" to confirm`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />}
        {checkboxLabel && <Checkbox label={checkboxLabel} checked={checked} onChange={(e) => setChecked(e.target.checked)} />}
      </div>
    </Modal>
  );
}
