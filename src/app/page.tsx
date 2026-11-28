import {
  BusinessCatalog,
  type CatalogBusiness,
} from "@/components/businesses/BusinessCatalog";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ui/States";
import {
  fetchTodayAvailabilityByBusiness,
  recentWindowStartIso,
} from "@/lib/availability-today";
import { formatPanamaTime } from "@/lib/dates";
import { getAuthContext } from "@/lib/auth";
import { translateError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { parseAmenities } from "@/types/database";
import { resolveArtKind, resolveCategory } from "@/lib/categories";

export default async function HomePage() {
  const supabase = await createClient();

  // `category` llega con la migración 20261127000100; si aún no existe, se consulta sin ella.
  let businessesQuery = await supabase
    .from("businesses")
    .select("id, name, zone, cover_image_url, amenities, category")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (businessesQuery.error?.code === "42703") {
    businessesQuery = (await supabase
      .from("businesses")
      .select("id, name, zone, cover_image_url, amenities")
      .eq("is_active", true)
      .order("created_at", { ascending: true })) as typeof businessesQuery;
  }

  const { data: businesses, error: businessesError } = businessesQuery;

  if (businessesError) {
    return (
      <div className="mx-auto max-w-[1024px] space-y-8 px-6 pt-10 min-[900px]:px-[22px] min-[900px]:pt-20">
        <PageHeader
          eyebrow="Panamá"
          title="Reserva lo que necesitas en Panamá"
          subtitle="Reserva canchas y servicios por horario en Panamá."
        />
        <ErrorState
          title="No pudimos cargar los negocios"
          message={translateError(businessesError)}
        />
      </div>
    );
  }

  const businessIds = (businesses ?? []).map((b) => b.id);
  const priceMap = new Map<string, { min: number; count: number }>();
  let todayMap = new Map<string, { firstSlotIso: string; slotCount: number }>();
  const bookingCounts = new Map<string, number>();

  if (businessIds.length > 0) {
    const { data: activeServices } = await supabase
      .from("services")
      .select("id, business_id, price, slot_duration_minutes")
      .in("business_id", businessIds)
      .eq("is_active", true);

    // Disponibilidad de hoy y conteo de reservas en paralelo; si fallan, simplemente no se muestran.
    const since = recentWindowStartIso(30);
    const [availability, counts] = await Promise.all([
      fetchTodayAvailabilityByBusiness(supabase, activeServices ?? []).catch(
        () => new Map<string, { firstSlotIso: string; slotCount: number }>(),
      ),
      supabase.rpc("get_business_booking_counts", { p_since: since }),
    ]);
    todayMap = availability;
    if (!counts.error) {
      (counts.data ?? []).forEach((row) =>
        bookingCounts.set(row.business_id, Number(row.booking_count)),
      );
    }

    (activeServices ?? []).forEach((service) => {
      const price = Number(service.price);
      const existing = priceMap.get(service.business_id);
      if (!existing) {
        priceMap.set(service.business_id, { min: price, count: 1 });
      } else {
        priceMap.set(service.business_id, {
          min: Math.min(existing.min, price),
          count: existing.count + 1,
        });
      }
    });
  }

  const catalogBusinesses: CatalogBusiness[] = (businesses ?? []).map(
    (business) => {
      const stats = priceMap.get(business.id);
      const amenities = parseAmenities(business.amenities);
      const category = resolveCategory(business.category, business.name, ...amenities);
      return {
        id: business.id,
        name: business.name,
        zone: business.zone,
        cover_image_url: business.cover_image_url,
        amenities,
        category,
        artKind: resolveArtKind(category, business.name, ...amenities),
        minPrice: stats ? stats.min : null,
        serviceCount: stats ? stats.count : 0,
        // Se formatea en el servidor para evitar diferencias de Intl al hidratar
        todayFirstSlot: todayMap.has(business.id)
          ? formatPanamaTime(todayMap.get(business.id)!.firstSlotIso)
          : null,
        recentBookings: bookingCounts.get(business.id) ?? 0,
      };
    },
  );

  // «Para ti» solo se ofrece a clientes con sesión iniciada.
  const { profile } = await getAuthContext();

  return <BusinessCatalog businesses={catalogBusinesses} showSuggestions={profile?.role === "customer"} />;
}
