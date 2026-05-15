/* landing -- redesigning to warm brutalism / artisanal dark (see docs/TestDesign.md) */

import DashboardLayout from '../components/DashboardLayout';
import Navbar from '../components/NavBar';
import Info from '../components/Info';
import Options from '../components/Options';
import Chart from '../components/Chart';

export default function Hero() {
  return (
    <DashboardLayout
      header={<Navbar />}
      info={<Info />}
      options={<Options />}
      chart={<Chart />}
    />
  );
}
