import { type ReactNode } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";

export interface MapMarker {
  position: {
    lat: number;
    lng: number;
  };
  label: string;
  title?: string;
  icon?: string;
}

interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  path?: Array<{ lat: number; lng: number }>;
  className?: string;
  children?: ReactNode;
}

const mapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: true,
  disableDefaultUI: false,
};

export default function MapView({ center, zoom = 13, markers = [], path = [], className = "" }: MapViewProps) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries: ["places"],
  });

  if (!googleMapsApiKey) {
    return (
      <div className={`grid min-h-[320px] place-items-center rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 ${className}`}>
        <div>
          <p className="font-semibold text-slate-900">Google Maps key is missing.</p>
          <p>Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your frontend environment.</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`grid min-h-[320px] place-items-center rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 ${className}`}>
        <p>Unable to load Google Maps.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`grid min-h-[320px] place-items-center rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 ${className}`}>
        <p>Loading map...</p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 ${className}`}>
      <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={center} zoom={zoom} options={mapOptions}>
        {markers.map((marker) => (
          <Marker key={`${marker.position.lat}-${marker.position.lng}-${marker.label}`} position={marker.position} label={marker.label} title={marker.title} icon={marker.icon} />
        ))}
        {path && path.length > 1 ? (
          <Polyline
            path={path}
            options={{
              strokeColor: "#0ea5e9",
              strokeOpacity: 0.95,
              strokeWeight: 5,
              clickable: false,
              draggable: false,
              editable: false,
            }}
          />
        ) : null}
      </GoogleMap>
    </div>
  );
}
