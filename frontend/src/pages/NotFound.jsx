import { Compass } from 'lucide-react';
import StatusScreen from '../components/ui/StatusScreen';
import Button from '../components/ui/Button';

export default function NotFound({ inline }) {
  return (
    <div className={inline ? '' : 'min-h-screen bg-white'}>
      <StatusScreen
        icon={Compass}
        title="We could not find that page"
        actions={
          <>
            <Button variant="primary" to={inline ? '/admin' : '/'}>{inline ? 'Back to admin' : 'Go to homepage'}</Button>
            {!inline && <Button to="/city-care">See a live demo queue</Button>}
          </>
        }
      >
        The link may be mistyped, or the business may have changed its link more than 90 days ago.
      </StatusScreen>
    </div>
  );
}
