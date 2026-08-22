// what this particular roaster deployment can do. sync is off by default, so
// the Orders queue only exists on installs paired with a storefront -- rather
// than showing a dead tab everywhere, we ask the backend and hide it.

import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { useSettings } from '../lib/settings';

export function useCapabilities(): api.Capabilities {
	const { settings } = useSettings();
	// assume off until told otherwise: a backend we can't reach shouldn't
	// flash a tab that then disappears.
	const [caps, setCaps] = useState<api.Capabilities>({ sync_enabled: false });

	useEffect(() => {
		let cancelled = false;
		api
			.getCapabilities(settings.backendUrl)
			.then((c) => !cancelled && setCaps(c))
			.catch(() => !cancelled && setCaps({ sync_enabled: false }));
		return () => {
			cancelled = true;
		};
	}, [settings.backendUrl]);

	return caps;
}
